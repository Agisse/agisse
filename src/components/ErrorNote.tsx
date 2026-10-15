import { AlertCircle } from 'lucide-react'

export const ErrorNote = ({ text }: { text: string }) => (
  <p className="notice notice--error" role="alert">
    <AlertCircle aria-hidden="true" /> <span>{text}</span>
  </p>
)
