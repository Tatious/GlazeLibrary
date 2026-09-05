import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

// Patterns that should only appear inside src/components/. Each entry maps to
// a regex matched against any JSX string literal / template element / object
// value in pages/, hooks/, contexts/ etc. — if it matches, the rule fails
// with the given message. Keeps the design system from drifting.
const designSystemBans = [
  {
    pattern: 'animate-spin',
    message:
      'Use <Spinner /> from src/components instead of an inline spinner div.',
  },
  {
    pattern: 'animate-pulse',
    message:
      'Use <Skeleton /> / <SkeletonHeader /> / <SkeletonGrid /> from src/components instead of inline animate-pulse blocks.',
  },
  {
    pattern: 'safe-area-inset-(left|right)',
    message:
      'Use <PageLayout> for page chrome — it already applies safe-area padding (top/bottom insets stay allowed for header/footer spacers).',
  },
  {
    // Banner-specific: matches the exact "bg-red-100 dark:bg-red-900/30
    // text-red-700" combo used by the error banner. Avoids false-positives
    // on button hover states (`hover:bg-red-100 hover:text-red-700`).
    pattern: 'bg-red-100 dark:bg-red-900\\/30 text-red-700',
    message:
      'Use <Alert variant="error"> instead of inline error-banner classes.',
  },
  {
    // The canonical "input border + ring" combo. Caught with two anchors to
    // avoid hitting buttons that share `border-2 border-clay-300` for their
    // outline styling.
    pattern: 'rounded-lg border-2 border-clay-300[^"]*focus:ring-(sage|terracotta)-500',
    message:
      'Use <Input> / <Textarea> from src/components instead of inline input classes.',
  },
]

const noRestrictedSyntax = designSystemBans.flatMap(({ pattern, message }) => [
  { selector: `Literal[value=/${pattern}/]`, message },
  { selector: `TemplateElement[value.raw=/${pattern}/]`, message },
])

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    // Guardrails: forbid duplicated design-system patterns in every file
    // EXCEPT the component implementations themselves.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/components/**'],
    rules: {
      'no-restricted-syntax': ['error', ...noRestrictedSyntax],
    },
  },
)
