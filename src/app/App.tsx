import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Theme preview until routing and layouts land (PR 5 and 6 of phase 0).
export function App() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 p-4">
      <h1 className="font-heading text-2xl font-semibold">Gestionale edile</h1>
      <Card>
        <CardHeader>
          <CardTitle>Anteprima del tema</CardTitle>
          <CardDescription>Colori, caratteri e componenti base di shadcn/ui.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="site">Cantiere</Label>
            <Input id="site" placeholder="Via Roma 12, Torino" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>Aperto</Badge>
            <Badge variant="secondary">In pausa</Badge>
            <Badge variant="outline">Chiuso</Badge>
            <Badge variant="destructive">Sopra budget</Badge>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button>Salva</Button>
          <Button variant="outline">Annulla</Button>
          <Button variant="ghost">Altro</Button>
          <Button variant="destructive">Elimina</Button>
        </CardFooter>
      </Card>
    </main>
  )
}
