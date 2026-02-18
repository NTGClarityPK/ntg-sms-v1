import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { FfmpegCommand } from 'fluent-ffmpeg';

// Use bundled FFmpeg from ffmpeg-static so we don't rely on system PATH (e.g. Windows).
let ffmpegPathSet = false;
function ensureFfmpegPath(): void {
  if (ffmpegPathSet) return;
  try {
    const ffmpegStatic = require('ffmpeg-static');
    if (ffmpegStatic && typeof ffmpegStatic === 'string') {
      const ffmpeg = require('fluent-ffmpeg');
      ffmpeg.setFfmpegPath(ffmpegStatic);
      ffmpegPathSet = true;
    }
  } catch {
    // ffmpeg-static not available or unsupported platform; will rely on system ffmpeg
  }
}

const MAX_VIDEO_WIDTH = 1280;
const MAX_VIDEO_HEIGHT = 720;
/** CRF 28 = good quality, smaller files. Lower = better quality, larger. 28–30 is a good balance. */
const VIDEO_CRF = 28;
const AUDIO_BITRATE = '128k';

/**
 * Compress video using FFmpeg. Uses bundled binary from ffmpeg-static when available; otherwise system FFmpeg. Falls back to original buffer on error.
 */
export async function compressVideo(
  buffer: Buffer,
  _mimeType: string,
  originalName: string,
): Promise<Buffer> {
  const ext = (originalName.split('.').pop() || 'mp4').toLowerCase();
  const safeExt = /^(mp4|webm|mov|avi|mkv)$/i.test(ext) ? ext : 'mp4';
  const inputPath = path.join(os.tmpdir(), `assessment-video-in-${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`);
  const outputPath = path.join(os.tmpdir(), `assessment-video-out-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`);

  try {
    await fs.promises.writeFile(inputPath, buffer);
  } catch {
    return buffer;
  }

  try {
    ensureFfmpegPath();
    const ffmpeg = await import('fluent-ffmpeg');
    // scale: max 1280x720, keep aspect ratio
    const scaleFilter = `scale='min(${MAX_VIDEO_WIDTH},iw)':'min(${MAX_VIDEO_HEIGHT},ih)':force_original_aspect_ratio=decrease`;
    const cmd: FfmpegCommand = ffmpeg.default(inputPath)
      .outputOptions([
        '-movflags', '+faststart',
        '-max_muxing_queue_size', '1024',
        '-crf', String(VIDEO_CRF),
      ])
      .videoFilters([scaleFilter])
      .videoCodec('libx264')
      .audioCodec('aac')
      .audioBitrate(AUDIO_BITRATE)
      .output(outputPath);

    await new Promise<void>((resolve, reject) => {
      cmd
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err))
        .run();
    });

    const outBuffer = await fs.promises.readFile(outputPath);
    await fs.promises.unlink(outputPath).catch(() => {});
    await fs.promises.unlink(inputPath).catch(() => {});

    // Never return a larger file than the original (re-encoding can sometimes increase size)
    if (outBuffer.length >= buffer.length) {
      return buffer;
    }
    return outBuffer;
  } catch (err) {
    // FFmpeg not installed, or conversion failed – return original so upload still succeeds
    if (process.env.NODE_ENV !== 'production') {
      const msg = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn('[video-compression] Skipped (FFmpeg missing or error):', msg);
    }
    await fs.promises.unlink(inputPath).catch(() => {});
    await fs.promises.unlink(outputPath).catch(() => {});
    return buffer;
  }
}
