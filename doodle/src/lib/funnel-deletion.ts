// Shared by standalone metrics cleanup and the atomic account deletion transaction.
// Names are fixed Redis namespaces, and actor hashes are supplied as Lua variables.
export function funnelDeletionLua(actor: string, aliases: string, prefix: string) {
  return `
 local actors=redis.call('SMEMBERS',${aliases});table.insert(actors,${actor})
 for _,actor in ipairs(actors) do
  -- Reject already admitted callbacks after deletion for the maximum event retention.
  redis.call('SET',${prefix}..'deleted:'..actor,'1','EX',366*86400)
  local history=${prefix}..'history:'..actor
  for _,key in ipairs(redis.call('SMEMBERS',history)) do redis.call('SREM',key,actor) end
  redis.call('DEL',history,${prefix}..'identity:'..actor,${prefix}..'alias:'..actor)
 end
 redis.call('DEL',${aliases})
 `;
}
