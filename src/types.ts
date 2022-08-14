export interface Env {
  gh_token: string

  // Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
  KV: KVNamespace
  //
  // Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
  // MY_DURABLE_OBJECT: DurableObjectNamespace;
  //
  // Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
  // MY_BUCKET: R2Bucket;
}

export interface IRepo {
  username: string
  type: 'orgs' | 'users'
  exclude?: Array<string>
  includeOnly?: Array<string>
}
