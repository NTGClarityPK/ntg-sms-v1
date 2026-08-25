const IMAGE_MAX_ORIGINAL_BYTES = 5 * 1024 * 1024;
const IMAGE_MAX_EDGE = 1280;
const IMAGE_JPEG_QUALITY = 0.72;
const FILE_MAX_BYTES = 3 * 1024 * 1024;
const VOICE_MAX_BYTES = 2 * 1024 * 1024;
const VIDEO_MAX_BYTES = 12 * 1024 * 1024;
const VOICE_MAX_MS = 5 * 60 * 1000;
const VIDEO_MAX_MS = 30 * 1000;

export const SUPPORT_MEDIA_LIMITS = {
  IMAGE_MAX_ORIGINAL_BYTES,
  FILE_MAX_BYTES,
  VOICE_MAX_BYTES,
  VIDEO_MAX_BYTES,
  VOICE_MAX_MS,
  VIDEO_MAX_MS,
} as const;

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image'));
    };
    img.src = url;
  });
}

/** Compress image to max edge 1280 JPEG ~0.72. Rejects originals over 5 MB. */
export async function compressSupportImage(file: File): Promise<{ blob: Blob; fileName: string }> {
  if (file.size > IMAGE_MAX_ORIGINAL_BYTES) {
    throw new Error('Image must be 5 MB or smaller');
  }
  const img = await loadImage(file);
  const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process image');
  ctx.drawImage(img, 0, 0, width, height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Image compression failed'))),
      'image/jpeg',
      IMAGE_JPEG_QUALITY,
    );
  });
  const base = file.name.replace(/\.[^.]+$/, '') || 'image';
  return { blob, fileName: `${base}.jpg` };
}

export function assertFileWithinLimit(file: File): void {
  if (file.size > FILE_MAX_BYTES) {
    throw new Error('File must be 3 MB or smaller');
  }
}

export function assertVoiceWithinLimit(blob: Blob): void {
  if (blob.size > VOICE_MAX_BYTES) {
    throw new Error('Voice note must be 2 MB or smaller');
  }
}

export function assertVideoWithinLimit(blob: Blob): void {
  if (blob.size > VIDEO_MAX_BYTES) {
    throw new Error('Screen recording must be 12 MB or smaller');
  }
}

export async function captureSupportScreenshot(): Promise<{ blob: Blob; fileName: string }> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: false,
  });
  try {
    const track = stream.getVideoTracks()[0];
    if (!track) throw new Error('No display track');
    const ImageCaptureCtor = (
      window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => { grabFrame: () => Promise<ImageBitmap> } }
    ).ImageCapture;
    let bitmap: ImageBitmap;
    if (ImageCaptureCtor) {
      const capture = new ImageCaptureCtor(track);
      bitmap = await capture.grabFrame();
    } else {
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not capture screenshot');
      ctx.drawImage(video, 0, 0);
      video.pause();
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Screenshot failed'))),
          'image/jpeg',
          IMAGE_JPEG_QUALITY,
        );
      });
      return { blob, fileName: `screenshot-${Date.now()}.jpg` };
    }
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not capture screenshot');
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Screenshot failed'))),
        'image/jpeg',
        IMAGE_JPEG_QUALITY,
      );
    });
    return { blob, fileName: `screenshot-${Date.now()}.jpg` };
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}

export type MediaRecorderSession = {
  stop: () => Promise<Blob>;
  cancel: () => void;
  getElapsedMs: () => number;
};

export async function startVoiceRecording(): Promise<MediaRecorderSession> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  return createRecorderSession(stream, VOICE_MAX_MS, 'audio/webm');
}

export async function startScreenRecording(): Promise<MediaRecorderSession> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 15 },
    audio: true,
  });
  return createRecorderSession(stream, VIDEO_MAX_MS, 'video/webm');
}

function createRecorderSession(
  stream: MediaStream,
  maxMs: number,
  mimeType: string,
): MediaRecorderSession {
  const chunks: BlobPart[] = [];
  const preferred = MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined;
  const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
  const startedAt = Date.now();
  let maxTimer: ReturnType<typeof setTimeout> | null = null;
  let resolveStop: ((blob: Blob) => void) | null = null;

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  recorder.onstop = () => {
    stream.getTracks().forEach((t) => t.stop());
    if (maxTimer) clearTimeout(maxTimer);
    const blob = new Blob(chunks, { type: recorder.mimeType || mimeType });
    resolveStop?.(blob);
    resolveStop = null;
  };

  recorder.start(250);
  maxTimer = setTimeout(() => {
    if (recorder.state === 'recording') recorder.stop();
  }, maxMs);

  return {
    getElapsedMs: () => Date.now() - startedAt,
    stop: () =>
      new Promise<Blob>((resolve) => {
        resolveStop = resolve;
        if (recorder.state === 'recording') recorder.stop();
        else resolve(new Blob(chunks, { type: recorder.mimeType || mimeType }));
      }),
    cancel: () => {
      resolveStop = null;
      if (recorder.state === 'recording') recorder.stop();
      else stream.getTracks().forEach((t) => t.stop());
      if (maxTimer) clearTimeout(maxTimer);
    },
  };
}

export function isMediaExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= Date.now();
}
