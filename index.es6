import fetch from 'node-fetch'
import url from 'url'
import {Minimatch} from 'minimatch'

export default class GithubVinyl {
  constructor (options) {
    this.options = {}
  }

  src (patters, options) {

  }

  dest (folder, options) {

  }
}

export class GithubRepo {
  constructor (owner, repo) {
    this.owner = owner
    this.repo = repo
  }

  readPath (branch, path, cb) {
    return this.makeRequest(
      'GET',
      `/repos/${this.owner}/${this.repo}/contents/${path}?ref=${branch}`
    )
  }

  readBranch (branch, cb) {
    return repo.getRefFromBranch(branch)
      .then(data => this.readTree(data.object.sha))
  }

  readTree (sha, cb) {
    return this.makeRequest(
      'GET',
      `/repos/${this.owner}/${this.repo}/git/trees/${sha}`
    )
  }

  getRefFromBranch (branch) {
    return this.makeRequest(
      'GET',
      `/repos/${this.owner}/${this.repo}/git/refs/heads/${branch}`
    )
  }

  makeRequest (method, path) {
    return fetch(url.resolve('https://api.github.com', path), {
      method: method,
      headers: {
        Authorization: 'token ' + process.env.GITHUB_AUTH_TOKEN,
        'User-Agent': 'github-vinyl (node module)'
      }
    }).then(res => {
      if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText}: ${res.text()}`)
      }

      return res.json()
    })
  }
}

export class GithubGlobMatcher {
  constructor (repo, ref, patterns, options) {
    this.repo = repo
    this.ref = ref
    this.pathCache = Object.create(null)
    this.patterns = new Minimatch(typeof patterns === 'string' ? patterns : ('{' + patterns.join(',') + '}')).set
    this.matches = []
  }

  static match (repo, ref, patterns, options) {
    return new GithubGlobMatcher(repo, ref, patterns, options).process()
  }

  process () {
    var index = 0

    var processNext = () => {
      if (index >= this.patterns.length) return this.matches
      return Promise.resolve(this.processOne(this.patterns[index++])).then(processNext)
    }

    return Promise.resolve(processNext())
  }

  processOne (segments) {
    var firstNonString = 0
    while (typeof segments[firstNonString] === 'string') ++firstNonString

    var prefix = segments.slice(0, firstNonString).join('/')
    var remaining = segments.slice(firstNonString)

    if (!remaining.length) {
      return this.readPath(prefix).then(data => {
        if (data.type === 'file') this.matches.push(data)
      }, () => {})
    }

    console.log(prefix, segments)
  }

  readPath (path) {
    if (!this.pathCache[path]) {
      this.pathCache[path] = this.repo.readPath(this.ref, path)
    }

    return this.pathCache[path]
  }
}

var repo = new GithubRepo('hayes', 'github-api-test-data')

void GithubGlobMatcher.match(repo, 'master', ['**/*.text', 'readme.md']).then(console.log, console.error)

// repo.readPath('master', '/foo/bar/baz.text').then(data => console.log(data)).catch(console.error)
