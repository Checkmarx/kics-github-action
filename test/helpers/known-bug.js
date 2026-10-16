'use strict'

const knownBug = (reason) => (process.env.KNOWN_BUGS === 'skip' ? { skip: reason } : { todo: reason })

module.exports = { knownBug }
