const TAG_RE = /<\/?translate_input>\n?/g

export function stripTranslateInputTags(text: string): string {
  return text.replace(TAG_RE, '')
}
