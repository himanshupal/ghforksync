import { Env, IRepo } from './types'

const apiBaseUrl = `https://api.github.com`

export const createOrMigrateRepos = async (controller: ScheduledController, env: Env) => {
  const organization = await env.KV.get('organization')
  const nextRequestDelay = Number(await env.KV.get('nextRequestDelay'))
  const gist_id = await env.KV.get('gist_id')
  const metadata = {
    headers: {
      Accept: `application/vnd.github+json`,
      Authorization: `token ${env.gh_token}`,
      'User-Agent': organization!
    }
  }

  // const rateLimitResponse = await fetch(`https://api.github.com/rate_limit`, metadata)
  // const rateLimitData = await rateLimitResponse.json()
  // console.log({ rateLimitData })

  try {
    const gistResponse = await fetch(`${apiBaseUrl}/gists/${gist_id}`, metadata)
    const gistData: Record<string, any> = await gistResponse.json()

    if (!(gistData['files'] && gistData['files'].hasOwnProperty('clone_data.json'))) {
      // throw new Error('gist_read_err')
      throw new Error('invalid_gist_data')
    }

    const repoList: Array<IRepo> = JSON.parse(gistData['files']['clone_data.json']['content'])

    console.info(`gist_fetched`)
    const orgRepoListResponse = await fetch(`${apiBaseUrl}/orgs/${organization}/repos?per_page=100`, metadata)
    const orgRepoList: Array<{ name: string; fork: string }> = await orgRepoListResponse.json()
    const mappedOrgRepoList = orgRepoList.map(({ name, fork }) => ({ name, fork }))

    const actions = []
    const accounts = []

    console.info(`accounts_fetched`)
    for (const account of repoList) {
      const accountType = account.type || 'users'
      const username = account.username
      try {
        const url = `${apiBaseUrl}/${accountType}/${username}/repos?per_page=100`
        const accountRepoResponse = await fetch(url, metadata)
        const accountRepoList: Array<{ name: string; forks_url: string }> = await accountRepoResponse.json()
        const mappedAccountRepoList = accountRepoList.map(({ name, forks_url }) => ({ name, forks_url, username }))
        const filteredAndMappedAccountRepoList = mappedAccountRepoList.filter(({ name }) => {
          if (account.includeOnly) return account.includeOnly.includes(name)
          if (account.exclude) return !account.exclude.includes(name)
          return true
        })
        accounts.push(filteredAndMappedAccountRepoList)
      } catch (err) {
        console.error('repos_fetch_fail:', err)
        // throw new Error('repos_fetch_fail ' + err)
      }
    }

    console.info(`repos_fetched`)
    for (const repos of accounts) {
      for (const { name, username, forks_url } of repos) {
        let found
        for (const { name: n, fork } of mappedOrgRepoList) {
          if (fork) {
            if (n === name) {
              actions.push({ url: `${apiBaseUrl}/repos/${organization}/${n}/merge-upstream` })
              found = true
            } else if (n === `${name}_${username}`) {
              actions.push({ url: forks_url, data: { organization, name: `${n}_forked` } })
              actions.push({ url: `${apiBaseUrl}/repos/${organization}/${n}/merge-upstream` })
              found = true
            }
          } else {
            if (n === name) {
              actions.push({ url: forks_url, data: { organization, name: `${n}_${username}` } })
              found = true
            } else if (n === `${name}_${username}`) {
              actions.push({ url: forks_url, data: { organization, name: `${n}_forked` } })
              found = true
            }
          }
        }
        if (!found) {
          actions.push({ url: forks_url, data: { organization } })
        }
      }
    }

    console.info(`actions_started`)
    for (const action of actions) {
      try {
        const body = action.data ? { body: JSON.stringify(action.data) } : {}
        console.log(`Requesting:`, action.url)
        await fetch(action.url, {
          method: 'POST',
          ...metadata,
          ...body
        })
        console.log(`action_call_success:`, action.url)
        await new Promise(r => setTimeout(r, nextRequestDelay, null)) // Fake delay to avoid too many requests
      } catch (err) {
        console.error('action_call_fail:', err)
        // throw new Error('action_call_fail: ' + err)
      }
    }
  } catch (err) {
    console.error('accounts_fetch_fail:', err)
    // throw new Error('accounts_fetch_fail: ' + err)
  }
}
