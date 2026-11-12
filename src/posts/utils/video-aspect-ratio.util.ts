/**
 * Pure Node.js MP4/MOV track header parser to extract video width and height without external dependencies.
 */
export function parseMp4Dimensions(
  buffer: Buffer,
): { width: number; height: number } | null {
  if (!buffer || buffer.length < 16) return null;

  function scanBoxes(
    buf: Buffer,
    depth = 0,
  ): { width: number; height: number } | null {
    if (depth > 6) return null;
    let offset = 0;
    while (offset + 8 <= buf.length) {
      const size = buf.readUInt32BE(offset);
      const type = buf.toString('ascii', offset + 4, offset + 8);
      if (size === 0) break;
      const boxSize =
        size === 1 && offset + 16 <= buf.length
          ? Number(buf.readBigUInt64BE(offset + 8))
          : size;
      if (boxSize < 8 || offset + boxSize > buf.length) break;

      const subHeaderSize = size === 1 ? 16 : 8;

      if (type === 'moov' || type === 'trak' || type === 'mdia') {
        const sub = buf.subarray(offset + subHeaderSize, offset + boxSize);
        const res = scanBoxes(sub, depth + 1);
        if (res) return res;
      } else if (type === 'tkhd') {
        // Track Header Box
        const version = buf.readUInt8(offset + subHeaderSize);
        // Version 0: pos = subHeaderSize + 4 (flags) + 72 = subHeaderSize + 76
        // Version 1: pos = subHeaderSize + 4 (flags) + 84 = subHeaderSize + 88
        const pos =
          version === 1
            ? offset + subHeaderSize + 88
            : offset + subHeaderSize + 76;
        if (pos + 8 <= offset + boxSize) {
          const width = buf.readUInt16BE(pos);
          const height = buf.readUInt16BE(pos + 4);
          if (width > 0 && height > 0) {
            return { width, height };
          }
        }
      }

      offset += boxSize;
    }
    return null;
  }

  try {
    return scanBoxes(buffer);
  } catch {
    return null;
  }
}

/**
 * Validate that video dimensions or aspect ratio adhere to 9:16 vertical reels.
 * Target ratio: 9 / 16 = 0.5625
 * Acceptable vertical tolerance: [0.50, 0.62]
 */
export function validateReelAspectRatio(options: {
  aspectRatio?: string | null;
  width?: number | null;
  height?: number | null;
  buffer?: Buffer | null;
}): { isValid: boolean; ratio?: number; detected?: { width: number; height: number } } {
  const { aspectRatio, width, height, buffer } = options;

  // 1. Explicit string aspect ratio check
  if (aspectRatio && typeof aspectRatio === 'string') {
    const clean = aspectRatio.trim().toLowerCase().replace(/\s+/g, '');
    if (clean !== '9:16' && clean !== '9/16' && clean !== '0.5625') {
      return { isValid: false };
    }
  }

  // 2. Explicit width / height numbers check
  if (width && height && width > 0 && height > 0) {
    const ratio = width / height;
    if (ratio < 0.5 || ratio > 0.62) {
      return { isValid: false, ratio };
    }
  }

  // 3. Inspect buffer directly if available
  if (buffer && buffer.length > 0) {
    const dims = parseMp4Dimensions(buffer);
    if (dims && dims.width > 0 && dims.height > 0) {
      const ratio = dims.width / dims.height;
      if (ratio < 0.5 || ratio > 0.62) {
        return { isValid: false, ratio, detected: dims };
      }
      return { isValid: true, ratio, detected: dims };
    }
  }

  return { isValid: true };
}
