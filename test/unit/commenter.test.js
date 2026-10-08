'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { postPRComment, postJobSummary } = require('../../src/commenter')
const { startFakeGitHub, humanComment, MAX_COMMENT_LENGTH } = require('../helpers/fake-github')
const { kicsResults, query, finding } = require('../helpers/fixtures')
const { knownBug } = require('../helpers/known-bug')

const repo = { owner: 'o', repo: 'r' }
const PR = 1
const COMMENTS_PATH = '/repos/o/r/issues/1/comments'
const kicsBody = '![kics-logo](https://example.com/logo.png)\nold report'
const noExclusions = []

// Pending fix: PR #163 (fix-duplicated-comment). Remove the `knownBug` markers once it is merged.
const PR_163 = 'PR #163: comment lookup must paginate and match on the KICS marker, not the author'

async function post(fake, results = kicsResults(), { withQueries = false, excluded = noExclusions, prNumber = PR } = {}) {
    await postPRComment(results, repo, prNumber, fake.octokit, withQueries, excluded)
}

const postedBody = (fake) => fake.writes().at(-1).body.body

test('PR comment lifecycle', async (t) => {
    await t.test('creates a comment when none exists', async (t) => {
        const fake = await startFakeGitHub(t, { comments: [humanComment(1)] })
        await post(fake)
        assert.deepEqual(fake.writes().map((r) => `${r.method} ${r.path}`), [`POST ${COMMENTS_PATH}`])
    })

    await t.test('updates the existing KICS comment instead of adding another', async (t) => {
        const fake = await startFakeGitHub(t, {
            comments: [humanComment(1), { id: 2, user: { login: 'github-actions[bot]' }, body: kicsBody }, humanComment(3)],
        })
        await post(fake, kicsResults({ kics_version: 'v9.9.9' }))

        assert.deepEqual(fake.writes().map((r) => `${r.method} ${r.path}`), ['PATCH /repos/o/r/issues/comments/2'])
        assert.match(fake.comments.find((c) => c.id === 2).body, /KICS version: v9\.9\.9/, 'the stale report is replaced')
        assert.ok(!fake.comments.find((c) => c.id === 2).body.includes('old report'))
    })

    await t.test('re-running on the same PR keeps a single KICS comment', async (t) => {
        const fake = await startFakeGitHub(t, { comments: [humanComment(1)] })
        await post(fake, kicsResults({ kics_version: 'v1.0.0' }))
        await post(fake, kicsResults({ kics_version: 'v2.0.0' }))
        await post(fake, kicsResults({ kics_version: 'v3.0.0' }))

        const kicsComments = fake.comments.filter((c) => c.body.startsWith('![kics-logo]('))
        assert.equal(kicsComments.length, 1, fake.calls().join('\n'))
        assert.match(kicsComments[0].body, /v3\.0\.0/)
    })

    await t.test('only touches the pull request it was asked about', async (t) => {
        const fake = await startFakeGitHub(t)
        await post(fake, kicsResults(), { prNumber: 42 })
        assert.deepEqual(fake.calls(), ['GET /repos/o/r/issues/42/comments', 'POST /repos/o/r/issues/42/comments'])
    })

    await t.test('authenticates with the provided token', async (t) => {
        const fake = await startFakeGitHub(t)
        await post(fake)
        assert.ok(fake.requests.every((r) => r.authorization === 'token token'))
    })

    await t.test('does not treat a quoted KICS report as the KICS comment', async (t) => {
        const fake = await startFakeGitHub(t, { comments: [{ id: 7, user: { login: 'someone' }, body: '> ' + kicsBody }] })
        await post(fake)
        assert.deepEqual(fake.writes().map((r) => `${r.method} ${r.path}`), [`POST ${COMMENTS_PATH}`])
    })

    await t.test('does not touch a human comment that merely mentions KICS', async (t) => {
        const fake = await startFakeGitHub(t, { comments: [{ id: 7, user: { login: 'someone' }, body: 'KICS found nothing, nice!' }] })
        await post(fake)
        assert.deepEqual(fake.writes().map((r) => `${r.method} ${r.path}`), [`POST ${COMMENTS_PATH}`])
        assert.equal(fake.comments.find((c) => c.id === 7).body, 'KICS found nothing, nice!')
    })
})

test('finding the existing KICS comment in a busy thread', async (t) => {
    await t.test('updates it when buried past the first 30 comments', knownBug(PR_163), async (t) => {
        const comments = Array.from({ length: 40 }, (_, i) => humanComment(i))
        comments.push({ id: 1000, user: { login: 'github-actions[bot]' }, body: kicsBody })
        const fake = await startFakeGitHub(t, { comments })

        await post(fake)

        assert.ok(fake.calls().includes('PATCH /repos/o/r/issues/comments/1000'), fake.calls().join('\n'))
        assert.ok(!fake.calls().some((c) => c.startsWith('POST')), 'must not create a duplicate')
    })

    await t.test('updates it when it is on page 3 of 100+ comments per page', knownBug(PR_163), async (t) => {
        const comments = Array.from({ length: 250 }, (_, i) => humanComment(i))
        comments.push({ id: 1000, user: { login: 'github-actions[bot]' }, body: kicsBody })
        const fake = await startFakeGitHub(t, { comments })

        await post(fake)

        assert.ok(fake.calls().includes('PATCH /repos/o/r/issues/comments/1000'), fake.calls().join('\n'))
        assert.ok(!fake.calls().some((c) => c.startsWith('POST')), 'must not create a duplicate')
        assert.ok(fake.requests.filter((r) => r.method === 'GET').length <= 3, 'lists 100 comments per page, not 30')
    })

    await t.test('updates it when it was posted by an author other than github-actions[bot]', knownBug(PR_163), async (t) => {
        const fake = await startFakeGitHub(t, { comments: [{ id: 5, user: { login: 'my-app[bot]' }, body: kicsBody }] })
        await post(fake)
        assert.deepEqual(fake.writes().map((r) => `${r.method} ${r.path}`), ['PATCH /repos/o/r/issues/comments/5'])
    })

    await t.test('updates the oldest KICS comment when duplicates already exist', knownBug(PR_163), async (t) => {
        const fake = await startFakeGitHub(t, {
            comments: [
                { id: 10, user: { login: 'someone' }, body: kicsBody },
                { id: 11, user: { login: 'someone' }, body: kicsBody },
            ],
        })
        await post(fake)
        assert.deepEqual(fake.writes().map((r) => `${r.method} ${r.path}`), ['PATCH /repos/o/r/issues/comments/10'])
    })
})

test('GitHub comment size limit', async (t) => {
    await t.test('a normal report is well under the limit', async (t) => {
        const fake = await startFakeGitHub(t)
        await post(fake)
        assert.ok(postedBody(fake).length < MAX_COMMENT_LENGTH)
    })

    await t.test('a huge report with queries still gets posted', knownBug('GitHub rejects bodies over 65536 characters with 422; the report must be truncated or split'), async (t) => {
        const fake = await startFakeGitHub(t)
        const many = Array.from({ length: 400 }, (_, i) => finding({ file_name: `modules/service-${i}/main.tf`, line: i + 1 }))
        const results = kicsResults({ queries: [query({ files: many })] })

        await post(fake, results, { withQueries: true, excluded: ['description_id', 'similarity_id'] })

        assert.equal(fake.comments.length, 1, 'a comment must exist even when the full report is too large')
        assert.ok(fake.comments[0].body.length <= MAX_COMMENT_LENGTH)
    })
})

test('report content', async (t) => {
    const reportFor = async (t, results, options) => {
        const fake = await startFakeGitHub(t)
        await post(fake, results, options)
        return postedBody(fake)
    }

    await t.test('starts with the KICS marker used to find the comment again', async (t) => {
        const body = await reportFor(t, kicsResults())
        assert.ok(body.startsWith('![kics-logo]('))
    })

    await t.test('shows the KICS version, severity counts and total', async (t) => {
        const body = await reportFor(t, kicsResults())
        assert.match(body, /\*\*KICS version: v2\.1\.20\*\*/)
        assert.match(body, /\| HIGH \| 1 \|/)
        assert.match(body, /\| MEDIUM \| 2 \|/)
        assert.match(body, /\| LOW \| 1 \|/)
        assert.match(body, /\| TOTAL \| 4 \|/)
    })

    await t.test('lists severities from most to least severe, only those the report contains', async (t) => {
        const results = kicsResults({ severity_counters: { LOW: 3, HIGH: 1, INFO: 2 }, total_counter: 6 })
        const body = await reportFor(t, results)
        const order = [...body.matchAll(/\| (CRITICAL|HIGH|MEDIUM|LOW|INFO|TRACE) \| \d+ \|/g)].map((m) => m[1])
        assert.deepEqual(order, ['HIGH', 'LOW', 'INFO'])
    })

    await t.test('has a row, with its icon, for every severity KICS can report', async (t) => {
        const severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO', 'TRACE']
        const queries = severities.map((severity) => query({ severity, query_name: `${severity} query` }))
        const body = await reportFor(t, kicsResults({ queries }))
        for (const severity of severities) assert.match(body, new RegExp(`\\| !\\[${severity}\\]\\(https://[^)]+\\) \\| ${severity} \\| 1 \\|`), severity)
        assert.match(body, /\| TOTAL \| 6 \|/)
        assert.ok(!body.includes('undefined'))
    })

    await t.test('shows scan metrics, with execution time computed from start and end', async (t) => {
        const body = await reportFor(t, kicsResults({ files_scanned: 12, files_parsed: 11, files_failed_to_scan: 1, queries_total: 280, queries_failed_to_execute: 2 }))
        assert.match(body, /Files scanned .*\| 12\n/)
        assert.match(body, /Files parsed .*\| 11\n/)
        assert.match(body, /Files failed to scan .*\| 1\n/)
        assert.match(body, /Total executed queries .*\| 280\n/)
        assert.match(body, /Queries failed to execute .*\| 2\n/)
        assert.match(body, /Execution time .*\| 7\n/)
    })

    await t.test('a clean scan reports zero findings and no query table', async (t) => {
        const body = await reportFor(t, kicsResults({ queries: [] }), { withQueries: true })
        assert.match(body, /\| TOTAL \| 0 \|/)
        assert.ok(!/\| HIGH \| [1-9]/.test(body))
    })

    await t.test('omits the queries table unless requested', async (t) => {
        const body = await reportFor(t, kicsResults(), { withQueries: false })
        assert.ok(!body.includes('### Queries Results'))
        assert.ok(!body.includes('Security Group With Unrestricted Ingress'))
    })
})

test('report content with queries', async (t) => {
    const withQueries = async (t, results, excluded = noExclusions) => {
        const fake = await startFakeGitHub(t)
        await post(fake, results, { withQueries: true, excluded })
        const body = postedBody(fake)
        const table = body.split('### Queries Results\n')[1]
        const lines = table.split('</td>')[0].split('\n').filter((l) => l.trim() && !l.startsWith('<'))
        const rows = lines.filter((l) => l.startsWith('|'))
        return { body, header: rows[0], rows: rows.slice(2), lines }
    }

    await t.test('has one row per finding, not per query', async (t) => {
        const { rows } = await withQueries(t, kicsResults())
        assert.equal(rows.length, 4)
    })

    await t.test('links each query name to its documentation', async (t) => {
        const { body } = await withQueries(t, kicsResults())
        assert.ok(body.includes('[Security Group With Unrestricted Ingress](https://docs.kics.io/latest/queries/terraform-queries/aws/4728cd65-a20c-49da-8b31-9c08b423e4db)'))
    })

    await t.test('titles columns from the snake_case report keys', async (t) => {
        const { header } = await withQueries(t, kicsResults())
        assert.match(header, /\| Query Name/)
        assert.match(header, /\| Similarity Id/)
        assert.match(header, /\| File Name/)
    })

    await t.test('never shows the raw query_url column', async (t) => {
        const { header } = await withQueries(t, kicsResults())
        assert.ok(!/Query Url/.test(header))
    })

    await t.test('hides the columns the workflow excluded', async (t) => {
        const { header, body } = await withQueries(t, kicsResults(), ['description_id', 'similarity_id', 'search_line', 'search_value'])
        for (const hidden of ['Description Id', 'Similarity Id', 'Search Line', 'Search Value']) assert.ok(!header.includes(hidden), hidden)
        assert.match(header, /\| Severity/)
        assert.ok(!body.includes('a1b2c3d4e5f60718'), 'excluded values are not leaked in rows')
    })

    await t.test('keeps rows aligned with the header when a finding lacks a column', async (t) => {
        const sparse = finding({ file_name: 'a.tf' })
        delete sparse.search_value
        delete sparse.actual_value
        const { header, rows } = await withQueries(t, kicsResults({ queries: [query({ files: [finding(), sparse] })] }))
        const columns = (line) => line.replace(/\|$/, '').split('|').length
        assert.equal(columns(rows[1]), columns(header))
    })

    await t.test('keeps a multi-line value inside its table cell', knownBug('only the first newline is replaced, so a second one breaks the markdown table'), async (t) => {
        const multiline = finding({ actual_value: 'line one\nline two\nline three' })
        const { lines } = await withQueries(t, kicsResults({ queries: [query({ files: [multiline] })] }))
        assert.ok(lines.every((l) => l.startsWith('|')), `stray lines outside the table:\n${lines.join('\n')}`)
    })

    await t.test('keeps a value containing a pipe inside its table cell', knownBug('unescaped | in a value (e.g. a regex in search_value) shifts every following column'), async (t) => {
        const piped = finding({ search_value: 'a|b' })
        const { header, rows } = await withQueries(t, kicsResults({ queries: [query({ files: [piped] })] }))
        const columns = (line) => line.replace(/\\\|/g, '').replace(/\|$/, '').split('|').length
        assert.equal(columns(rows[0]), columns(header))
    })
})

test('job summary', async (t) => {
    await t.test('writes the same report to the workflow run summary', async (t) => {
        const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'kics-summary-')), 'summary.md')
        fs.writeFileSync(file, '')
        const previous = process.env.GITHUB_STEP_SUMMARY
        process.env.GITHUB_STEP_SUMMARY = file
        t.after(() => {
            if (previous === undefined) delete process.env.GITHUB_STEP_SUMMARY
            else process.env.GITHUB_STEP_SUMMARY = previous
            fs.rmSync(path.dirname(file), { recursive: true, force: true })
        })

        await postJobSummary(kicsResults(), true, noExclusions)

        const written = fs.readFileSync(file, 'utf8')
        assert.ok(written.startsWith('![kics-logo]('))
        assert.match(written, /\| TOTAL \| 4 \|/)
        assert.match(written, /### Queries Results/)
    })
})
