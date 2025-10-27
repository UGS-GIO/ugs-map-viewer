export default {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'subject-case': [0], // Allow any case in subject
        'scope-enum': [2, 'always', ['common', 'hazards', 'minerals', 'ccs', 'wetlands', 'wetlandplants', 'geophysics', 'release', 'data-reviewer']],
        'footer-max-line-length': [1, 'always', 200],
        'body-max-line-length': [1, 'always', 200]
    }
};