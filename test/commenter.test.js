const test = require('node:test')
const assert = require('node:assert')
const github = require('@actions/github')
const { postPRComment } = require('../src/commenter')

const repo = { owner: 'o', repo: 'r' }
const results = {
    kics_version: 'v0', severity_counters: {}, total_counter: 0, files_scanned: 0, files_parsed: 0,
    files_failed_to_scan: 0, queries_total: 0, queries_failed_to_execute: 0, start: 0, end: 0,
}
const kicsBody = '![kics-logo](https://example.com/logo.png)\nold report'

// Real octokit client (so paginate behaves like in the action) with a fake GitHub API behind fetch.
// Like GitHub, listing comments returns 30 per page unless per_page is set.
function fakeGitHub(comments) {
    const calls = []
    const fetch = async (url, init = {}) => {
        const u = new URL(url)
        const method = (init.method || 'GET').toUpperCase()
        calls.push(`${method} ${u.pathname}`)
        let data = []
        if (method === 'GET') {
            const perPage = Number(u.searchParams.get('per_page') || 30)
            const page = Number(u.searchParams.get('page') || 1)
            data = comments.slice((page - 1) * perPage, page * perPage)
        }
        const headers = { 'content-type': 'application/json' }
        if (method === 'GET' && comments.length > data.length) {
            const perPage = Number(u.searchParams.get('per_page') || 30)
            const page = Number(u.searchParams.get('page') || 1)
            if (page * perPage < comments.length) {
                const next = new URL(u); next.searchParams.set('page', page + 1)
                headers.link = `<${next}>; rel="next"`
            }
        }
        return new Response(JSON.stringify(data), { status: method === 'POST' ? 201 : 200, headers })
    }
    const octokit = github.getOctokit('token', { request: { fetch } })
    return { octokit, calls }
}

const human = (i) => ({ id: i, user: { login: 'someone' }, body: `comment ${i}` })
const run = (octokit) => postPRComment(results, repo, 1, octokit, false, [])

test('updates the KICS comment when it is buried past the first 30 comments (bot author)', async () => {
    const comments = []
    for (let i = 0; i < 40; i++) comments.push(human(i))
    comments.push({ id: 1000, user: { login: 'github-actions[bot]' }, body: kicsBody }) // newest, so on page 2
    const { octokit, calls } = fakeGitHub(comments)
    await run(octokit)
    assert.ok(calls.includes('PATCH /repos/o/r/issues/comments/1000'), calls.join('\n'))
    assert.ok(!calls.some((c) => c.startsWith('POST')), 'must not create a duplicate')
})

test('updates the KICS comment posted by a non-bot author', async () => {
    const { octokit, calls } = fakeGitHub([{ id: 5, user: { login: 'my-app[bot]' }, body: kicsBody }])
    await run(octokit)
    assert.ok(calls.includes('PATCH /repos/o/r/issues/comments/5'), calls.join('\n'))
    assert.ok(!calls.some((c) => c.startsWith('POST')))
})

test('creates a comment when none exists', async () => {
    const { octokit, calls } = fakeGitHub([human(1)])
    await run(octokit)
    assert.ok(calls.includes('POST /repos/o/r/issues/1/comments'), calls.join('\n'))
})

test('does not treat a quoted KICS report as the KICS comment', async () => {
    const { octokit, calls } = fakeGitHub([{ id: 7, user: { login: 'someone' }, body: '> ' + kicsBody }])
    await run(octokit)
    assert.ok(calls.includes('POST /repos/o/r/issues/1/comments'), calls.join('\n'))
})

test('finds the KICS comment across several pages of 100+ comments', async () => {
    const comments = []
    for (let i = 0; i < 250; i++) comments.push(human(i))
    comments.push({ id: 1000, user: { login: 'github-actions[bot]' }, body: kicsBody }) // on page 3
    const { octokit, calls } = fakeGitHub(comments)
    await run(octokit)
    assert.equal(calls.filter((c) => c.startsWith('GET')).length, 3, calls.join('\n'))
    assert.ok(calls.includes('PATCH /repos/o/r/issues/comments/1000'), calls.join('\n'))
    assert.ok(!calls.some((c) => c.startsWith('POST')), 'must not create a duplicate')
})
