'use strict'

const http = require('node:http')
const github = require('@actions/github')

const MAX_COMMENT_LENGTH = 65536
const DEFAULT_PER_PAGE = 30
const MAX_PER_PAGE = 100

function json(res, status, body, headers = {}) {
    res.writeHead(status, { 'content-type': 'application/json', ...headers })
    res.end(JSON.stringify(body))
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = []
        req.on('data', (c) => chunks.push(c))
        req.on('end', () => resolve(Buffer.concat(chunks).toString()))
        req.on('error', reject)
    })
}

async function startFakeGitHub(t, { comments = [], failWith } = {}) {
    const store = comments.map((c) => ({ ...c }))
    const requests = []
    let nextId = Math.max(1_000_000, ...store.map((c) => c.id + 1))

    const server = http.createServer(async (req, res) => {
        const url = new URL(req.url, 'http://fake')
        const raw = await readBody(req)
        const body = raw ? JSON.parse(raw) : undefined
        requests.push({
            method: req.method,
            path: url.pathname,
            query: Object.fromEntries(url.searchParams),
            body,
            authorization: req.headers.authorization,
        })

        if (failWith) return json(res, failWith, { message: 'simulated outage' })

        const list = url.pathname.match(/^\/repos\/([^/]+)\/([^/]+)\/issues\/(\d+)\/comments$/)
        const single = url.pathname.match(/^\/repos\/([^/]+)\/([^/]+)\/issues\/comments\/(\d+)$/)

        if (list && req.method === 'GET') {
            const perPage = Math.min(Number(url.searchParams.get('per_page') || DEFAULT_PER_PAGE), MAX_PER_PAGE)
            const page = Number(url.searchParams.get('page') || 1)
            const data = store.slice((page - 1) * perPage, page * perPage)
            const headers = {}
            if (page * perPage < store.length) {
                const next = new URL(req.url, `http://${req.headers.host}`)
                next.searchParams.set('page', String(page + 1))
                headers.link = `<${next}>; rel="next"`
            }
            return json(res, 200, data, headers)
        }

        if (list && req.method === 'POST') {
            if (body.body.length > MAX_COMMENT_LENGTH) return tooLong(res)
            const comment = { id: nextId++, user: { login: 'github-actions[bot]' }, body: body.body }
            store.push(comment)
            return json(res, 201, comment)
        }

        if (single && req.method === 'PATCH') {
            const comment = store.find((c) => c.id === Number(single[3]))
            if (!comment) return json(res, 404, { message: 'Not Found' })
            if (body.body.length > MAX_COMMENT_LENGTH) return tooLong(res)
            comment.body = body.body
            return json(res, 200, comment)
        }

        return json(res, 404, { message: 'Not Found' })
    })

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const url = `http://127.0.0.1:${server.address().port}`

    const close = () => {
        server.closeAllConnections()
        return new Promise((resolve) => server.close(resolve))
    }
    t.after(close)

    return {
        url,
        // @actions/github fixes an https proxy agent at import time, so a plain http agent is supplied
        octokit: github.getOctokit('token', { baseUrl: url, request: { agent: new http.Agent() } }),
        comments: store,
        requests,
        calls: () => requests.map((r) => `${r.method} ${r.path}`),
        writes: () => requests.filter((r) => r.method !== 'GET'),
    }
}

function tooLong(res) {
    json(res, 422, {
        message: 'Validation Failed',
        errors: [{ resource: 'IssueComment', code: 'unprocessable', field: 'data', message: `Body is too long (maximum is ${MAX_COMMENT_LENGTH} characters)` }],
    })
}

const humanComment = (id) => ({ id, user: { login: 'someone' }, body: `comment ${id}` })

module.exports = { startFakeGitHub, humanComment, MAX_COMMENT_LENGTH }
