'use client'

import dynamic from 'next/dynamic'
import { loader } from '@monaco-editor/react'
import type { OnChange, OnMount } from '@monaco-editor/react'

// Suppress Monaco's internal CancellationError — thrown whenever an async
// Monaco operation is interrupted (unmount, tab switch, navigation). React 19's
// error overlay surfaces this as a visible error even though it's harmless.
// Guard with typeof window: 'use client' modules still evaluate on the server.
if (typeof window !== 'undefined') {
  loader.init().catch((e: unknown) => {
    if ((e as Error)?.message !== 'Canceled') throw e
  })
}

const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-[#1e1e1e] text-zinc-500 text-sm">
      Loading editor…
    </div>
  ),
})

interface MonacoEditorProps {
  value: string
  onChange: (value: string) => void
  language?: string
  height?: string
}

export function MonacoEditor({ value, onChange, language = 'cpp', height = '100%' }: MonacoEditorProps) {
  const handleMount: OnMount = (editor) => {
    editor.focus()
  }

  const handleChange: OnChange = (val) => {
    onChange(val ?? '')
  }

  return (
    <Editor
      height={height}
      language={language}
      theme="vs-dark"
      value={value}
      onChange={handleChange}
      onMount={handleMount}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        tabSize: 2,
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        automaticLayout: true,
        padding: { top: 12, bottom: 12 },
        fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, monospace",
      }}
    />
  )
}
