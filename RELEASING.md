# Releasing

Every release after the first is a tag. No token is stored anywhere.

```bash
# bump the version in package.json, commit it, then
git tag v0.1.1
git push origin v0.1.1
```

`.github/workflows/release.yml` publishes it with npm trusted publishing: the runner proves who it
is over OIDC, npm checks the request came from this repository and this workflow file, and mints a
short-lived credential. Provenance is attached automatically.

## One time, before any of that works

**The first publish cannot use trusted publishing.** npmjs.com only lets you attach a trusted
publisher to a package that already exists, and this package does not exist yet, so there is no
settings page to configure. That is a known npm limitation, tracked at
[npm/cli#8544](https://github.com/npm/cli/issues/8544) and still open. PyPI allows configuring a
publisher for a package that has never been released; npm does not, yet.

So, once:

**1. Publish 0.1.0 by hand.**

```bash
npm login                 # your account, on your machine
npm publish --access public
```

Do this from a clean checkout of the tag you mean to ship, and check `npm pack --dry-run` first so
you know what is in the tarball.

**2. Attach the trusted publisher.** On npmjs.com, open the package, then Settings, then Trusted
Publisher, and enter exactly:

| Field | Value |
| --- | --- |
| Publisher | GitHub Actions |
| Organization or user | `arnelirobles` |
| Repository | `create-barako-app` |
| Workflow filename | `release.yml` |
| Environment | leave empty |

The workflow filename is the file name alone, not a path. It has to match the workflow that
publishes, which is why renaming `release.yml` later means updating this setting too, and why a
rename without it fails at publish with an authorisation error rather than a missing-file error.

**3. Check `repository.url` in `package.json` still points at this repository.** npm matches it
against the repository the OIDC token came from.

After that, `npm logout` if you like. Nothing on any machine needs npm credentials again.

## What the workflow refuses to do

- publish when the tag and `package.json` version disagree
- publish when the generator no longer produces a project, or leaves an unsubstituted `{{TOKEN}}`
- publish on an npm older than 11.5.1, which cannot do trusted publishing and would fall back to
  asking for a token that is not there

## Version numbers

The generator pins the image tags it was tested against (`API_TAG` and `CONSOLE_TAG` in
`bin/create-barako-app.mjs`). Moving those is a release of this package, because a generated
project is only as good as the pair of images it was proven against. When barakoCMS 4.1.0 lands it
moves the API contract to 2, and the console version that speaks contract 2 has to move with it, in
the same commit.
