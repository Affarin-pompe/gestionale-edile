import { useState, type ReactNode } from 'react'
import { FormProvider, type FieldValues, type UseFormReturn } from 'react-hook-form'
import { FormattedMessage } from 'react-intl'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { MessageId } from '@/i18n/it'
import { useShowFormError } from './form-errors'

/**
 * A short form in a side panel (a line, a chapter), for things edited without leaving the
 * page. Errors show as in EntityForm: 422 under the fields, the others above the buttons.
 * After a save the panel closes; the caller shows the notice.
 */
export function SheetForm<TValues extends FieldValues, TOutput>({
  open,
  onOpenChange,
  title,
  description,
  form,
  onSubmit,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: MessageId
  /** Data that says what the panel is about, e.g. the item a measurement belongs to. */
  description?: ReactNode
  form: UseFormReturn<TValues, unknown, TOutput>
  onSubmit: (values: TOutput) => Promise<void>
  children: ReactNode
}) {
  const [problem, setProblem] = useState<string>()
  const showError = useShowFormError(form)

  const submit = form.handleSubmit(async (values) => {
    setProblem(undefined)
    try {
      await onSubmit(values)
      onOpenChange(false)
    } catch (error) {
      setProblem(showError(error))
    }
  })

  function change(next: boolean) {
    if (!next) setProblem(undefined)
    onOpenChange(next)
  }

  return (
    <Sheet open={open} onOpenChange={change}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b px-5">
          <SheetTitle>
            <FormattedMessage id={title} />
          </SheetTitle>
          {/* Radix wants a description; without data it repeats the required-fields note */}
          <SheetDescription className="break-words">
            {description ?? <FormattedMessage id="form.requiredNote" />}
          </SheetDescription>
        </SheetHeader>
        <FormProvider {...form}>
          <form
            noValidate
            onSubmit={(event) => void submit(event)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <FieldGroup className="flex-1 gap-5 overflow-y-auto p-5">{children}</FieldGroup>
            <SheetFooter className="border-t px-5">
              {problem && (
                <p role="alert" className="text-sm text-destructive">
                  {problem}
                </p>
              )}
              <div className="flex flex-wrap justify-end gap-2.5">
                <SheetClose asChild>
                  <Button type="button" variant="outline">
                    <FormattedMessage id="form.cancel" />
                  </Button>
                </SheetClose>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  <FormattedMessage
                    id={form.formState.isSubmitting ? 'form.saving' : 'form.save'}
                  />
                </Button>
              </div>
            </SheetFooter>
          </form>
        </FormProvider>
      </SheetContent>
    </Sheet>
  )
}
