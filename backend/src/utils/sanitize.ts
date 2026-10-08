// Strips HTML tags and null bytes from user-generated free text (review
// titles/comments, message bodies). React already escapes everything it
// renders - this app never uses dangerouslySetInnerHTML for that content -
// so this is defense-in-depth: it stops the *stored* value itself from
// carrying markup that some other future renderer (an admin tool, an
// export, a notification email) might trust without re-escaping.
export function sanitizePlainText(input: string): string {
  // eslint-disable-next-line no-control-regex -- deliberately stripping a literal NUL byte
  return input.replace(/<[^>]*>/g, "").replace(/\x00/g, "").trim();
}
