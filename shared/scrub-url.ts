// Query strings and fragments carry reset tokens, invite codes and OAuth requests, and paths carry job and search ids,
// so analytics and error reports get /jobs/:id and nothing after it.
export const scrubUrl = (url: string) =>
  url.replace(/[?#].*$/s, '').replace(/\/(?:[0-9a-f]{8}-[0-9a-f-]{27}|(?=[^/]*\d)[\w-]{8,})(?=\/|$)/gi, '/:id')
