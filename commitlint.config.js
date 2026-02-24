export default {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'header-max-length': [2, 'always', 100], // Enforce 100 char limit on header
        'subject-case': [0], // Allow any case in subject
        'scope-enum': [2, 'always', ['common', 'hazards', 'minerals', 'ccs', 'wetlands', 'wetlandplants', 'geophysics', 'rockcore', 'release', 'data-reviewer']],
        'footer-max-line-length': [1, 'always', 200],
        'body-max-line-length': [1, 'always', 200]
    }
};