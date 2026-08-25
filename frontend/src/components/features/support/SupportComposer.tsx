'use client';

import { useRef, useState, type ReactNode } from 'react';
import {
  ActionIcon,
  Group,
  TextInput,
  Text,
  Tooltip,
} from '@mantine/core';
import {
  IconMicrophone,
  IconPaperclip,
  IconScreenShare,
  IconSend,
  IconCamera,
} from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import {
  useSendSupportMessage,
  useUploadSupportFile,
} from '@/hooks/api/useSupport';
import { useThemeColors } from '@/lib/hooks/use-theme-colors';
import {
  SUPPORT_MEDIA_LIMITS,
  assertFileWithinLimit,
  assertVideoWithinLimit,
  assertVoiceWithinLimit,
  captureSupportScreenshot,
  compressSupportImage,
  startScreenRecording,
  startVoiceRecording,
  type MediaRecorderSession,
} from './supportMedia';

type Props = {
  conversationId: string | null;
  disabled?: boolean;
};

const iconBtnProps = {
  color: 'primary' as const,
  variant: 'filled' as const,
  radius: 'xl' as const,
  size: 'lg' as const,
};

export function SupportComposer({ conversationId, disabled }: Props) {
  const t = useTranslations('support');
  const { error: errorColor, primary } = useThemeColors();
  const [text, setText] = useState('');
  const [recordingKind, setRecordingKind] = useState<'voice' | 'video' | null>(null);
  const [recordingElapsedSec, setRecordingElapsedSec] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionRef = useRef<MediaRecorderSession | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendMutation = useSendSupportMessage();
  const uploadMutation = useUploadSupportFile();

  const busy = sendMutation.isPending || uploadMutation.isPending || !!recordingKind;
  const canSend = !!conversationId && !disabled && !busy;

  const showError = (message: string) => {
    notifications.show({
      title: t('errorTitle'),
      message,
      color: errorColor,
    });
  };

  const clearRecordingUi = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    sessionRef.current = null;
    setRecordingKind(null);
    setRecordingElapsedSec(0);
  };

  const uploadAndSend = async (
    messageType: 'image' | 'voice' | 'video' | 'file',
    blob: Blob,
    fileName: string,
  ) => {
    if (!conversationId) return;
    const uploaded = await uploadMutation.mutateAsync({
      conversationId,
      messageType,
      file: blob,
      fileName,
    });
    await sendMutation.mutateAsync({
      conversationId,
      messageType,
      content: fileName,
      fileUrl: uploaded.fileUrl,
      expiresAt: uploaded.expiresAt ?? undefined,
    });
  };

  const handleSendText = async () => {
    if (!conversationId || !text.trim()) return;
    const content = text.trim();
    setText('');
    try {
      await sendMutation.mutateAsync({
        conversationId,
        messageType: 'text',
        content,
      });
    } catch (e) {
      setText(content);
      showError(e instanceof Error ? e.message : t('sendFailed'));
    }
  };

  const handleImageFiles = async (files: FileList | null) => {
    if (!files?.[0] || !conversationId) return;
    try {
      const { blob, fileName } = await compressSupportImage(files[0]);
      await uploadAndSend('image', blob, fileName);
    } catch (e) {
      showError(e instanceof Error ? e.message : t('uploadFailed'));
    }
  };

  const handleFile = async (files: FileList | null) => {
    if (!files?.[0] || !conversationId) return;
    try {
      assertFileWithinLimit(files[0]);
      if (files[0].type.startsWith('image/')) {
        await handleImageFiles(files);
        return;
      }
      await uploadAndSend('file', files[0], files[0].name);
    } catch (e) {
      showError(e instanceof Error ? e.message : t('uploadFailed'));
    }
  };

  const handleScreenshot = async () => {
    if (!conversationId) return;
    try {
      const { blob, fileName } = await captureSupportScreenshot();
      await uploadAndSend('image', blob, fileName);
    } catch (e) {
      showError(e instanceof Error ? e.message : t('uploadFailed'));
    }
  };

  const startRecording = async (kind: 'voice' | 'video') => {
    if (!conversationId || sessionRef.current) return;
    try {
      const session =
        kind === 'voice' ? await startVoiceRecording() : await startScreenRecording();
      sessionRef.current = session;
      setRecordingKind(kind);
      setRecordingElapsedSec(0);
      timerRef.current = setInterval(() => {
        const elapsed = session.getElapsedMs();
        const max =
          kind === 'voice' ? SUPPORT_MEDIA_LIMITS.VOICE_MAX_MS : SUPPORT_MEDIA_LIMITS.VIDEO_MAX_MS;
        setRecordingElapsedSec(Math.floor(elapsed / 1000));
        if (elapsed >= max) {
          void stopRecording(kind);
        }
      }, 400);
    } catch (e) {
      showError(e instanceof Error ? e.message : t('recordingFailed'));
      clearRecordingUi();
    }
  };

  const stopRecording = async (kind: 'voice' | 'video') => {
    const session = sessionRef.current;
    if (!session || !conversationId) return;
    try {
      const blob = await session.stop();
      clearRecordingUi();
      if (kind === 'voice') {
        assertVoiceWithinLimit(blob);
        await uploadAndSend('voice', blob, `voice-${Date.now()}.webm`);
      } else {
        assertVideoWithinLimit(blob);
        await uploadAndSend('video', blob, `screen-${Date.now()}.webm`);
      }
    } catch (e) {
      clearRecordingUi();
      showError(e instanceof Error ? e.message : t('uploadFailed'));
    }
  };

  const cancelRecording = () => {
    sessionRef.current?.cancel();
    clearRecordingUi();
  };

  return (
    <BoxLikeComposer>
      {recordingKind && (
        <Group gap="sm" mb="xs">
          <Text size="sm" c={primary}>
            {recordingKind === 'voice'
              ? t('recordingVoiceTimed', {
                  elapsed: recordingElapsedSec,
                  max: Math.floor(SUPPORT_MEDIA_LIMITS.VOICE_MAX_MS / 1000),
                })
              : t('recordingScreenTimed', {
                  elapsed: recordingElapsedSec,
                  max: Math.floor(SUPPORT_MEDIA_LIMITS.VIDEO_MAX_MS / 1000),
                })}
          </Text>
          <ActionIcon
            id="support-stop-recording"
            color="primary"
            variant="filled"
            onClick={() => void stopRecording(recordingKind)}
            aria-label={t('stopAndSend')}
          >
            <IconSend size={16} />
          </ActionIcon>
          <ActionIcon
            id="support-cancel-recording"
            variant="subtle"
            onClick={cancelRecording}
            aria-label={t('cancelRecording')}
          >
            ×
          </ActionIcon>
        </Group>
      )}
      <Group gap="xs" wrap="nowrap" align="flex-end">
        <input
          ref={fileInputRef}
          type="file"
          hidden
          id="support-file-input"
          onChange={(e) => {
            void handleFile(e.target.files);
            e.target.value = '';
          }}
        />
        <Tooltip label={t('attachFile')}>
          <ActionIcon
            id="support-attach-file"
            {...iconBtnProps}
            disabled={!canSend}
            onClick={() => fileInputRef.current?.click()}
            aria-label={t('attachFile')}
          >
            <IconPaperclip size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t('screenshot')}>
          <ActionIcon
            id="support-screenshot"
            {...iconBtnProps}
            disabled={!canSend}
            onClick={() => void handleScreenshot()}
            aria-label={t('screenshot')}
          >
            <IconCamera size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t('voiceNote')}>
          <ActionIcon
            id="support-voice"
            {...iconBtnProps}
            disabled={!canSend || !!sessionRef.current}
            onClick={() => void startRecording('voice')}
            aria-label={t('voiceNote')}
          >
            <IconMicrophone size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t('screenRecord')}>
          <ActionIcon
            id="support-screen"
            {...iconBtnProps}
            disabled={!canSend || !!sessionRef.current}
            onClick={() => void startRecording('video')}
            aria-label={t('screenRecord')}
          >
            <IconScreenShare size={18} />
          </ActionIcon>
        </Tooltip>
        <TextInput
          id="support-message-input"
          style={{ flex: 1 }}
          placeholder={t('typeMessage')}
          value={text}
          disabled={!canSend}
          onChange={(e) => setText(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSendText();
            }
          }}
        />
        <ActionIcon
          id="support-send"
          color="primary"
          variant="filled"
          radius="xl"
          size="lg"
          disabled={
            !conversationId ||
            !!disabled ||
            !!recordingKind ||
            uploadMutation.isPending ||
            (!text.trim() && !sendMutation.isPending)
          }
          loading={sendMutation.isPending}
          onClick={() => void handleSendText()}
          aria-label={t('send')}
        >
          <IconSend size={18} />
        </ActionIcon>
      </Group>
    </BoxLikeComposer>
  );
}

function BoxLikeComposer({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        borderTop: '1px solid var(--mantine-color-default-border)',
        padding: 'var(--mantine-spacing-sm)',
      }}
    >
      {children}
    </div>
  );
}
