import { FormattedMessage } from 'react-intl'
import { Form } from 'react-router'
import { Button } from '@/components/ui/button'

export function LogoutButton() {
  return (
    <Form method="post" action="/esci">
      <Button type="submit" variant="outline">
        <FormattedMessage id="logout.submit" />
      </Button>
    </Form>
  )
}
