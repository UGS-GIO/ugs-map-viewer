module.exports = {
  branches: ['master'],
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'conventionalcommits',
        releaseRules: [
          { type: 'feat', release: 'minor' },
          { type: 'fix', release: 'patch' },
          { type: 'refactor', release: 'patch' },
          { type: 'perf', release: 'patch' },
          { type: 'docs', release: 'patch' },
          { type: 'style', release: 'patch' },
          { type: 'test', release: 'patch' },
          { type: 'build', release: 'patch' },
          { type: 'ci', release: 'patch' },
          { type: 'chore', release: 'patch' },
          { type: 'revert', release: 'patch' }
        ]
      }
    ],
    [
      '@semantic-release/release-notes-generator',
      {
        preset: 'conventionalcommits',
        presetConfig: {
          types: [
            { type: 'feat', section: 'Features' },
            { type: 'fix', section: 'Bug Fixes' },
            { type: 'refactor', section: 'Refactors' },
            { type: 'perf', section: 'Performance' },
            { type: 'docs', section: 'Documentation' },
            { type: 'style', section: 'Styling' },
            { type: 'test', section: 'Tests' },
            { type: 'build', section: 'Build System' },
            { type: 'ci', section: 'CI/CD' },
            { type: 'chore', section: 'Chores' },
            { type: 'revert', section: 'Reverts' }
          ]
        },
        writerOpts: {
          groupBy: 'scope',
          commitGroupsSort: (a, b) => {
            // Sort scopes: common first, then alphabetically
            if (a.title === 'common') return -1;
            if (b.title === 'common') return 1;
            return a.title.localeCompare(b.title);
          },
          commitsSort: ['type', 'subject'],
          commitPartial: `* **{{type}}**{{#if scope}}(\`{{scope}}\`){{/if}}: {{subject}}{{#each references}} ([{{issue}}]({{../host}}/{{../owner}}/{{../repository}}/issues/{{issue}})){{/each}}
`
        }
      }
    ],
    [
      '@semantic-release/changelog',
      {
        changelogFile: 'CHANGELOG.md'
      }
    ],
    [
      '@semantic-release/github',
      {
        successComment: '🎉 This PR is included in version ${nextRelease.version}',
        failComment: false
      }
    ],
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'package.json'],
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}'
      }
    ]
  ]
};
