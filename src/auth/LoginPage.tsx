import type { ComponentProps } from 'react'
import { FormattedMessage } from 'react-intl'
import { Form, useActionData, useNavigation } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { MessageId } from '@/i18n/it'
import type { loginAction } from './session'

export function LoginPage() {
  const result = useActionData<typeof loginAction>()
  const submitting = useNavigation().state === 'submitting'
  const fields = (result && 'fields' in result ? result.fields : undefined) ?? {}

  return (
    <Card>
      <CardHeader>
        <h1 className="font-heading text-lg font-medium">
          <FormattedMessage id="login.title" />
        </h1>
        <CardDescription>
          <FormattedMessage id="login.description" />
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Without an action the form posts to this URL, so the action still sees ?da= */}
        <Form method="post" className="flex flex-col gap-4">
          <Field
            name="email"
            type="email"
            label="login.email"
            autoComplete="username"
            error={fields.email}
            autoFocus
          />
          <Field
            name="password"
            type="password"
            label="login.password"
            autoComplete="current-password"
            error={fields.password}
          />
          {result && 'problem' in result && (
            <p role="alert" className="text-sm text-destructive">
              <FormattedMessage id={result.problem} />
            </p>
          )}
          <Button type="submit" disabled={submitting}>
            <FormattedMessage id={submitting ? 'login.submitting' : 'login.submit'} />
          </Button>
        </Form>
      </CardContent>
    </Card>
  )
}

function Field({
  name,
  label,
  error,
  ...input
}: { name: string; label: MessageId; error?: string } & ComponentProps<'input'>) {
  const errorId = `${name}-error`
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>
        <FormattedMessage id={label} />
      </Label>
      <Input
        id={name}
        name={name}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...input}
      />
      {/* The backend's message, shown as plain text */}
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
