export function isLocalFilePath(value?: string | null): value is string {
  if (!value) return false;
  return value.startsWith('/') || /^[A-Za-z]:\\/.test(value);
}

export function isRemoteHttpUrl(value?: string | null): value is string {
  if (!value) return false;
  return /^https?:\/\//i.test(value);
}

export function getOpenableLocalPath(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    if (isLocalFilePath(value)) return value;
  }
  return '';
}
