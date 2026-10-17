import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  ChevronDown,
  Clipboard,
  FileCode2,
  FileLock2,
  Folder,
  History,
  Info,
  Lock,
  Moon,
  RefreshCcw,
  Settings,
  ShieldAlert,
  SunMedium,
  TerminalSquare,
} from 'lucide-react'
import { presetList } from './data/presets'
import type { FileKind, PermissionBits, PermissionGroupKey, PermissionGroups, SpecialBits } from './lib/permissions'
import {
  bitsToOctal,
  bitsToSymbol,
  defaultGroups,
  defaultSpecialBits,
  fileNameToSafeShellToken,
  getFullModeString,
  getModeExplanation,
  getOctalMode,
  getPermissionSummary,
  groupLabels,
  parseOctalMode,
  parseSymbolicMode,
} from './lib/permissions'

type ThemeMode = 'dark' | 'light'
type HistoryItem = {
  id: string
  octal: string
  symbolic: string
  filename: string
  fileKind: FileKind
  time: string
}

const permissionsMeta = [
  { key: 'read', label: 'Read', value: 4, colorClass: 'text-cyan-300' },
  { key: 'write', label: 'Write', value: 2, colorClass: 'text-violet-300' },
  { key: 'execute', label: 'Execute', value: 1, colorClass: 'text-emerald-300' },
] as const

const referenceRows = [
  { mode: '400', meaning: 'Owner read only' },
  { mode: '200', meaning: 'Owner write only' },
  { mode: '100', meaning: 'Owner execute only' },
  { mode: '644', meaning: 'Readable by all, writable by owner' },
  { mode: '700', meaning: 'Private directory or script' },
  { mode: '755', meaning: 'Executable by all, writable by owner' },
  { mode: '777', meaning: 'Open to all users' },
  { mode: '4755', meaning: 'Setuid + executable' },
  { mode: '2755', meaning: 'Setgid + executable' },
  { mode: '1777', meaning: 'World-writable + sticky' },
]

const cheatSheet = [
  'chmod 600 file.txt — private file',
  'chmod 644 file.txt — standard readable file',
  'chmod 700 ~/project — private directory',
  'chmod 755 script.sh — executable script',
  'chmod 1777 /tmp — shared writable directory with sticky bit',
  'chmod 4755 /usr/local/bin/tool — tool runs as owner',
]

const navItems = [
  { id: 'calculator', label: 'Permission Calculator', icon: FileCode2 },
  { id: 'presets', label: 'Presets Library', icon: Folder },
  { id: 'sheet', label: 'Linux Cheat Sheet', icon: TerminalSquare },
  { id: 'history', label: 'Recent Calculations', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
]

const createHistoryEntry = (
  nextGroups: PermissionGroups,
  nextSpecial: SpecialBits,
  nextFileKind: FileKind,
  nextFilename: string,
): HistoryItem => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  octal: getOctalMode(nextGroups, nextSpecial),
  symbolic: getFullModeString(nextGroups, nextSpecial, nextFileKind),
  filename: nextFilename.trim() || 'deploy.sh',
  fileKind: nextFileKind,
  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
})

function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'dark'
    const storedTheme = window.localStorage.getItem('permix-theme') as ThemeMode | null
    return storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : 'dark'
  })
  const [fileKind, setFileKind] = useState<FileKind>('file')
  const [filename, setFilename] = useState('deploy.sh')
  const [groups, setGroups] = useState<PermissionGroups>(defaultGroups)
  const [special, setSpecial] = useState<SpecialBits>(defaultSpecialBits)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [copyStatus, setCopyStatus] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    if (typeof window === 'undefined') return []

    try {
      const storedHistory = window.localStorage.getItem('permix-history')
      return storedHistory ? (JSON.parse(storedHistory) as HistoryItem[]) : []
    } catch {
      window.localStorage.removeItem('permix-history')
      return []
    }
  })
  const [octalInput, setOctalInput] = useState('755')
  const [symbolicInput, setSymbolicInput] = useState('-rwxr-xr-x')
  const [conversionError, setConversionError] = useState('')

  const fileTypePrefix = fileKind === 'directory' ? 'd' : '-'
  const octalMode = useMemo(() => getOctalMode(groups, special), [groups, special])
  const fullMode = useMemo(() => getFullModeString(groups, special, fileKind), [groups, special, fileKind])
  const safeFilename = fileNameToSafeShellToken(filename)
  const chmodCommand = `chmod ${octalMode} ${safeFilename}`
  const explanation = getModeExplanation(groups, fileKind)
  const validationMessage = useMemo(() => {
    const normalized = filename.trim()
    if (!normalized) return 'Enter a filename or path to generate the command.'
    if (normalized.length > 255) return 'Filename is too long for a practical shell command.'
    return ''
  }, [filename])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    window.localStorage.setItem('permix-theme', theme)
  }, [theme])

  const syncModeInputs = (nextGroups: PermissionGroups, nextSpecial: SpecialBits, nextFileKind: FileKind) => {
    setOctalInput(getOctalMode(nextGroups, nextSpecial))
    setSymbolicInput(getFullModeString(nextGroups, nextSpecial, nextFileKind))
  }

  const recordHistory = (nextGroups: PermissionGroups, nextSpecial: SpecialBits, nextFileKind: FileKind, nextFilename: string) => {
    const entry = createHistoryEntry(nextGroups, nextSpecial, nextFileKind, nextFilename)

    setHistory((current) => {
      const duplicate = current.some(
        (item) =>
          item.octal === entry.octal &&
          item.symbolic === entry.symbolic &&
          item.filename === entry.filename &&
          item.fileKind === entry.fileKind,
      )

      const next = duplicate ? current : [entry, ...current].slice(0, 5)
      window.localStorage.setItem('permix-history', JSON.stringify(next))
      return next
    })
  }

  const updateGroup = (group: PermissionGroupKey, bit: keyof PermissionBits) => {
    const nextGroups = {
      ...groups,
      [group]: {
        ...groups[group],
        [bit]: !groups[group][bit],
      },
    }

    setGroups(nextGroups)
    syncModeInputs(nextGroups, special, fileKind)
    recordHistory(nextGroups, special, fileKind, filename)
  }

  const updateSpecial = (bit: keyof SpecialBits) => {
    const nextSpecial = {
      ...special,
      [bit]: !special[bit],
    }

    setSpecial(nextSpecial)
    syncModeInputs(groups, nextSpecial, fileKind)
    recordHistory(groups, nextSpecial, fileKind, filename)
  }

  const resetCalculator = () => {
    setGroups(defaultGroups)
    setSpecial(defaultSpecialBits)
    setFileKind('file')
    setFilename('deploy.sh')
    setOctalInput('755')
    setSymbolicInput('-rwxr-xr-x')
    setConversionError('')
    recordHistory(defaultGroups, defaultSpecialBits, 'file', 'deploy.sh')
  }

  const applyPreset = (preset: (typeof presetList)[number]) => {
    setGroups(preset.groups)
    setSpecial(preset.special)
    setFileKind(preset.fileKind)
    setFilename('deploy.sh')
    setOctalInput(preset.octal)
    setSymbolicInput(getFullModeString(preset.groups, preset.special, preset.fileKind))
    setConversionError('')
    recordHistory(preset.groups, preset.special, preset.fileKind, 'deploy.sh')
  }

  const handleOctalChange = (value: string) => {
    setOctalInput(value)
    const parsed = parseOctalMode(value)
    if (!parsed.valid) {
      setConversionError('Valid modes are 3 or 4 octal digits, for example 755 or 4755.')
      return
    }
    setGroups(parsed.permissions)
    setSpecial(parsed.special)
    setConversionError('')
    recordHistory(parsed.permissions, parsed.special, fileKind, filename)
  }

  const handleSymbolicChange = (value: string) => {
    setSymbolicInput(value)
    const parsed = parseSymbolicMode(value)
    if (!parsed.valid) {
      setConversionError('Use a symbolic form such as rwxr-xr-x or -rwxr-xr--.')
      return
    }
    setGroups(parsed.permissions)
    setSpecial(parsed.special)
    setConversionError('')
    recordHistory(parsed.permissions, parsed.special, fileKind, filename)
  }

  const copyValue = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopyStatus(label)
      window.setTimeout(() => setCopyStatus(null), 1500)
    } catch {
      setCopyStatus('Clipboard access unavailable in this browser.')
      window.setTimeout(() => setCopyStatus(null), 1800)
    }
  }

  const summary = getPermissionSummary(groups)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col lg:flex-row">
        <aside className="w-full border-b border-slate-800 bg-slate-950/85 backdrop-blur lg:max-w-[280px] lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col p-5">
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-cyan-500/20 bg-slate-900/80 px-3 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/20">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-50">PermiX</p>
                <p className="text-xs text-slate-400">Permissions lab</p>
              </div>
            </div>

            <nav className="space-y-2 text-sm">
              {navItems.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-left text-slate-200 transition hover:border-cyan-500/30 hover:bg-slate-900"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-cyan-300">
                        <Icon className="h-4 w-4" />
                      </span>
                      {item.label}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                  </button>
                )
              })}
            </nav>

            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Theme</p>
                <button
                  type="button"
                  onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
                  className="flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-slate-950 px-2 py-1.5 text-xs text-cyan-200"
                  aria-label="Toggle dark or light theme"
                >
                  {theme === 'dark' ? <SunMedium className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                  {theme === 'dark' ? 'Light' : 'Dark'}
                </button>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-300">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Local-only
                </span>
                <span className="text-slate-500">Browser session</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <header className="mb-6 flex flex-col gap-4 border-b border-slate-800 pb-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.24em] text-cyan-300">Linux Permissions Calculator</p>
              <h1 className="text-2xl font-semibold text-white sm:text-3xl">Linux Permissions Calculator</h1>
              <p className="mt-2 text-sm text-slate-300">Understand, calculate, and generate chmod permissions.</p>
            </div>
            <div className="flex items-center gap-2 self-start rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Local-only status
            </div>
          </header>

          <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
            <section className="space-y-6">
              <div className="resource-card p-4 sm:p-5">
                <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Calculator</h2>
                    <p className="text-sm text-slate-400">Choose a permission model for a file or directory.</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/70 p-1">
                    {(['file', 'directory'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setFileKind(mode)}
                        className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                          fileKind === mode
                            ? 'bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/30'
                            : 'text-slate-300 hover:text-white'
                        }`}
                        aria-pressed={fileKind === mode}
                      >
                        {mode === 'file' ? 'Regular file' : 'Directory'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  {(['owner', 'group', 'others'] as const).map((group) => (
                    <div key={group} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-200">{groupLabels[group]}</p>
                          <p className="text-xs text-slate-500">{bitsToOctal(groups[group])} / {bitsToSymbol(groups[group])}</p>
                        </div>
                        <span className="matrix-pill matrix-pill--active">{bitsToOctal(groups[group])}</span>
                      </div>

                      <div className="space-y-2">
                        {permissionsMeta.map((permission) => {
                          const active = groups[group][permission.key]
                          return (
                            <button
                              key={`${group}-${permission.key}`}
                              type="button"
                              data-active={active}
                              className="permission-toggle w-full justify-between px-3"
                              onClick={() => updateGroup(group, permission.key)}
                              aria-label={`${groupLabels[group]} ${permission.label} ${active ? 'enabled' : 'disabled'}`}
                            >
                              <span className="flex items-center gap-2 text-left">
                                <span className={`font-semibold ${permission.colorClass}`}>{permission.key[0].toUpperCase()}</span>
                                <span>{permission.label}</span>
                              </span>
                              <span className="text-xs text-slate-300">{permission.value}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
                  <label className="block space-y-2 text-sm text-slate-300">
                    <span className="font-medium text-slate-200">Filename or path</span>
                    <input
                      type="text"
                      value={filename}
                      onChange={(event) => setFilename(event.target.value)}
                      placeholder="deploy.sh"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-slate-100 outline-none ring-0 transition focus:border-cyan-500/50"
                      aria-invalid={!!validationMessage}
                    />
                  </label>

                  <div className="space-y-2 text-sm text-slate-300">
                    <span className="block font-medium text-slate-200">Object type</span>
                    <div className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-slate-100">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-2">
                          {fileKind === 'directory' ? <Folder className="h-4 w-4 text-cyan-300" /> : <FileLock2 className="h-4 w-4 text-violet-300" />}
                          {fileKind === 'directory' ? 'Directory' : 'Regular file'}
                        </span>
                        <span className="text-xs text-slate-400">prefix: {fileTypePrefix}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-100">
                  Directory execute permission allows traversal and access to contents. It does not run the directory as a program.
                </div>
              </div>

              <div className="resource-card p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Advanced permissions</h2>
                    <p className="text-sm text-slate-400">Special bits require deliberate intent and security review.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((current) => !current)}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                  >
                    {showAdvanced ? 'Hide' : 'Show'}
                    <ChevronDown className={`h-4 w-4 transition ${showAdvanced ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {showAdvanced && (
                  <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      {([
                        ['setuid', 'Setuid (4)'],
                        ['setgid', 'Setgid (2)'],
                        ['sticky', 'Sticky (1)'],
                      ] as const).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => updateSpecial(key)}
                          className={`rounded-xl border p-3 text-left transition ${
                            special[key]
                              ? 'border-violet-500/40 bg-violet-500/10 text-violet-100'
                              : 'border-slate-700 bg-slate-900 text-slate-300'
                          }`}
                          aria-pressed={special[key]}
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <span className="font-medium">{label}</span>
                            <span className="text-xs text-slate-400">{special[key] ? 'Enabled' : 'Off'}</span>
                          </div>
                          <p className="text-xs text-slate-400">
                            {key === 'setuid' && 'Executables can run as the owning user.'}
                            {key === 'setgid' && 'New files inherit the owning group.'}
                            {key === 'sticky' && 'Only file owners may remove files from shared directories.'}
                          </p>
                        </button>
                      ))}
                    </div>

                    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-300">
                      <p className="mb-2 font-medium text-slate-100">Examples</p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {['4755', '2755', '1777'].map((value) => (
                          <span key={value} className="rounded-full border border-cyan-500/20 bg-cyan-500/5 px-2 py-1 text-cyan-100">
                            {value}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="resource-card p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-white">Live command preview</h2>
                  <button
                    type="button"
                    onClick={resetCalculator}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 transition hover:border-cyan-500/30"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Reset
                  </button>
                </div>

                <div className="terminal-panel rounded-2xl p-4 font-mono text-sm text-slate-200">
                  <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-slate-500">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    <span className="ml-3">Generated command</span>
                  </div>
                  <p className="break-all text-cyan-200">{chmodCommand}</p>
                  <div className="mt-4 grid gap-3 text-xs text-slate-300 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                      <p className="mb-1 text-slate-500">Full symbolic mode</p>
                      <button type="button" onClick={() => copyValue(fullMode, 'symbolic mode')} className="text-left text-cyan-200 hover:text-cyan-100">
                        {fullMode}
                      </button>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                      <p className="mb-1 text-slate-500">Octal mode</p>
                      <button type="button" onClick={() => copyValue(octalMode, 'octal mode')} className="text-left text-violet-200 hover:text-violet-100">
                        {octalMode}
                      </button>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-slate-300">{explanation}</p>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => copyValue(chmodCommand, 'command')}
                    className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"
                  >
                    <Clipboard className="h-4 w-4" />
                    Copy Command
                  </button>
                  <button
                    type="button"
                    onClick={() => copyValue(octalMode, 'octal mode')}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-200"
                  >
                    <FileCode2 className="h-4 w-4" />
                    Copy Octal
                  </button>
                </div>
                {copyStatus && <p className="mt-3 text-sm text-emerald-300">{copyStatus}</p>}
              </div>
            </section>

            <aside className="space-y-6">
              <div className="resource-card p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">Conversion helpers</h2>
                  <Info className="h-4 w-4 text-cyan-300" />
                </div>

                <div className="space-y-4">
                  <label className="block space-y-2 text-sm text-slate-300">
                    <span className="font-medium text-slate-200">Octal to symbolic</span>
                    <input
                      type="text"
                      value={octalInput}
                      onChange={(event) => handleOctalChange(event.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-slate-100 outline-none focus:border-cyan-500/50"
                      placeholder="755"
                    />
                  </label>

                  <label className="block space-y-2 text-sm text-slate-300">
                    <span className="font-medium text-slate-200">Symbolic to octal</span>
                    <input
                      type="text"
                      value={symbolicInput}
                      onChange={(event) => handleSymbolicChange(event.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-slate-100 outline-none focus:border-cyan-500/50"
                      placeholder="rwxr-xr-x"
                    />
                  </label>

                  {conversionError && <p className="text-sm text-rose-300">{conversionError}</p>}
                </div>
              </div>

              <div className="resource-card p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">Permission summary</h2>
                  <Check className="h-4 w-4 text-emerald-300" />
                </div>
                <div className="space-y-3">
                  {summary.map((line) => (
                    <div key={line} className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-200">
                      {line}
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-cyan-100">
                  <p className="font-medium">Effective mode</p>
                  <p className="mt-1 font-mono text-base text-cyan-200">{fullMode}</p>
                </div>
              </div>

              <div className="resource-card p-4 sm:p-5">
                <h2 className="mb-4 text-lg font-semibold text-white">Preset library</h2>
                <div className="space-y-3">
                  {presetList.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950/60 p-3 text-left transition hover:border-cyan-500/30 hover:bg-slate-900"
                    >
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <span className="font-medium text-slate-100">{preset.name}</span>
                        <span className="rounded-full border border-cyan-500/20 bg-cyan-500/5 px-2 py-0.5 text-xs font-semibold text-cyan-200">
                          {preset.octal}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{preset.explanation}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="resource-card p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-white">Recent calculations</h2>
                  <button
                    type="button"
                    onClick={() => {
                      setHistory([])
                      localStorage.removeItem('permix-history')
                    }}
                    className="text-xs text-slate-400 hover:text-slate-200"
                  >
                    Clear history
                  </button>
                </div>
                <div className="space-y-3">
                  {history.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-700 p-3 text-sm text-slate-400">
                      No recent calculations yet.
                    </div>
                  ) : (
                    history.map((item) => (
                      <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="font-mono text-sm text-cyan-200">{item.octal}</span>
                          <span className="text-[11px] text-slate-500">{item.time}</span>
                        </div>
                        <p className="text-xs text-slate-300">{item.filename}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{item.fileKind === 'directory' ? 'Directory' : 'Regular file'}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </aside>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <div className="resource-card p-4 sm:p-5">
              <h3 className="mb-4 text-lg font-semibold text-white">Linux permissions reference table</h3>
              <div className="overflow-hidden rounded-xl border border-slate-800">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-900 text-slate-300">
                    <tr>
                      <th className="px-3 py-2 font-medium">Mode</th>
                      <th className="px-3 py-2 font-medium">Meaning</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-950/60 text-slate-200">
                    {referenceRows.map((row) => (
                      <tr key={row.mode}>
                        <td className="px-3 py-2 font-mono text-cyan-200">{row.mode}</td>
                        <td className="px-3 py-2">{row.meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="resource-card p-4 sm:p-5">
              <h3 className="mb-4 text-lg font-semibold text-white">chmod cheat sheet</h3>
              <ul className="space-y-2 text-sm text-slate-300">
                {cheatSheet.map((item) => (
                  <li key={item} className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 font-mono text-cyan-200">
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-100">
                <div className="mb-2 flex items-center gap-2 font-medium">
                  <ShieldAlert className="h-4 w-4" />
                  Security warning
                </div>
                Special bits and world-writable modes can increase risk. Review whether the access model matches your deployment requirements before applying them widely.
              </div>
            </div>
          </div>

          {validationMessage && (
            <div className="mt-6 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-sm text-rose-200">
              {validationMessage}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
