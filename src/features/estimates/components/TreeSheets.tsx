import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useIntl } from 'react-intl'
import { toast } from 'sonner'
import { useCompany } from '@/auth/me'
import { TextField } from '@/components/common/EntityForm'
import { SheetForm } from '@/components/common/SheetForm'
import {
  useChangeTree,
  type EstimateChapter,
  type EstimateChapterInput,
  type EstimateItem,
  type EstimateItemInput,
  type EstimateMeasurement,
  type EstimateMeasurementInput,
} from '../api'
import {
  chapterFormValues,
  chapterSchema,
  itemFormValues,
  itemSchema,
  measurementFormValues,
  measurementSchema,
  type ChapterFormValues,
  type ItemFormValues,
  type MeasurementFormValues,
} from '../schemas'

/** What the side panel edits: a new record under a parent, or an existing one. */
export type TreeEdit =
  | { kind: 'chapter'; parentId: string | null; chapter?: EstimateChapter; parentName?: string }
  | { kind: 'item'; chapterId: string; item?: EstimateItem; parentName: string }
  | { kind: 'measurement'; itemId: string; measurement?: EstimateMeasurement; parentName: string }

export function TreeSheet({
  estimateId,
  edit,
  onClose,
}: {
  estimateId: string
  edit: TreeEdit
  onClose: () => void
}) {
  const close = (open: boolean) => {
    if (!open) onClose()
  }
  switch (edit.kind) {
    case 'chapter':
      return <ChapterSheet estimateId={estimateId} edit={edit} onOpenChange={close} />
    case 'item':
      return <ItemSheet estimateId={estimateId} edit={edit} onOpenChange={close} />
    case 'measurement':
      return <MeasurementSheet estimateId={estimateId} edit={edit} onOpenChange={close} />
  }
}

function useSave(estimateId: string) {
  const intl = useIntl()
  const company = useCompany()
  const change = useChangeTree(company.slug, estimateId)
  return async (...args: Parameters<typeof change.mutateAsync>) => {
    await change.mutateAsync(...args)
    toast.success(intl.formatMessage({ id: 'estimates.tree.saved' }))
  }
}

function ChapterSheet({
  estimateId,
  edit,
  onOpenChange,
}: {
  estimateId: string
  edit: Extract<TreeEdit, { kind: 'chapter' }>
  onOpenChange: (open: boolean) => void
}) {
  const save = useSave(estimateId)
  const form = useForm<ChapterFormValues, unknown, EstimateChapterInput>({
    resolver: zodResolver(chapterSchema),
    defaultValues: chapterFormValues(edit.chapter),
  })
  const Text = TextField<ChapterFormValues>
  const { chapter } = edit
  return (
    <SheetForm
      open
      onOpenChange={onOpenChange}
      title={
        chapter
          ? 'estimates.chapter.editTitle'
          : edit.parentId
            ? 'estimates.chapter.newSubTitle'
            : 'estimates.chapter.newTitle'
      }
      description={edit.parentName}
      form={form}
      onSubmit={(input) =>
        chapter
          ? save({ kind: 'chapter', update: chapter, input })
          : save({ kind: 'chapter', create: { ...input, parent_id: edit.parentId } })
      }
    >
      <Text name="code" label="estimates.code" hint="estimates.chapter.code.hint" maxLength={50} />
      <Text name="title" label="estimates.chapter.title" maxLength={200} required />
    </SheetForm>
  )
}

function ItemSheet({
  estimateId,
  edit,
  onOpenChange,
}: {
  estimateId: string
  edit: Extract<TreeEdit, { kind: 'item' }>
  onOpenChange: (open: boolean) => void
}) {
  const save = useSave(estimateId)
  const form = useForm<ItemFormValues, unknown, EstimateItemInput>({
    resolver: zodResolver(itemSchema),
    defaultValues: itemFormValues(edit.item),
  })
  const Text = TextField<ItemFormValues>
  const { item } = edit
  return (
    <SheetForm
      open
      onOpenChange={onOpenChange}
      title={item ? 'estimates.item.editTitle' : 'estimates.item.newTitle'}
      description={edit.parentName}
      form={form}
      onSubmit={(input) =>
        item
          ? save({ kind: 'item', update: item, input })
          : save({ kind: 'item', create: { ...input, chapter_id: edit.chapterId } })
      }
    >
      <Text name="code" label="estimates.code" hint="estimates.item.code.hint" maxLength={50} />
      <Text
        name="description"
        label="estimates.item.description"
        multiline
        maxLength={5000}
        required
      />
      <Text name="unit" label="estimates.unit" hint="estimates.unit.hint" maxLength={20} required />
      <Text
        name="unit_price"
        label="estimates.unitPrice"
        hint="estimates.unitPrice.hint"
        inputMode="decimal"
        maxLength={18}
        required
      />
    </SheetForm>
  )
}

function MeasurementSheet({
  estimateId,
  edit,
  onOpenChange,
}: {
  estimateId: string
  edit: Extract<TreeEdit, { kind: 'measurement' }>
  onOpenChange: (open: boolean) => void
}) {
  const save = useSave(estimateId)
  const form = useForm<MeasurementFormValues, unknown, EstimateMeasurementInput>({
    resolver: zodResolver(measurementSchema),
    defaultValues: measurementFormValues(edit.measurement),
  })
  const Text = TextField<MeasurementFormValues>
  const { measurement } = edit
  return (
    <SheetForm
      open
      onOpenChange={onOpenChange}
      title={measurement ? 'estimates.measurement.editTitle' : 'estimates.measurement.newTitle'}
      description={edit.parentName}
      form={form}
      onSubmit={(input) =>
        measurement
          ? save({ kind: 'measurement', update: measurement, input })
          : save({ kind: 'measurement', create: { ...input, item_id: edit.itemId } })
      }
    >
      <Text
        name="description"
        label="estimates.measurement.description"
        hint="estimates.measurement.description.hint"
        maxLength={500}
      />
      {/* Plain keyboard: a phone's number pad has no minus, and deductions need it */}
      <Text
        name="equal_parts"
        label="estimates.equalParts"
        hint="estimates.measurement.factors.hint"
        maxLength={16}
      />
      <Text name="length" label="estimates.length" maxLength={16} />
      <Text name="width" label="estimates.width" maxLength={16} />
      <Text name="height" label="estimates.height" maxLength={16} />
    </SheetForm>
  )
}
