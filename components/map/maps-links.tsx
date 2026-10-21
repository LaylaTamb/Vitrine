import Link from "next/link"
import { MapIcon, MapPin, Navigation } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import {
  mapsDirectionsUrl,
  mapsPlaceUrl,
  type LatLng,
  type MapsTarget,
  type TravelMode,
} from "@/lib/domain/maps-links"
import { cn } from "@/lib/utils"

/*
 * Os atalhos para o Google Maps. Só links — sem estado e sem hook — para
 * servirem tanto na página do item (Server Component) quanto no cartão do
 * pino e no da Sugestão.
 */

const LINK_CLASS = buttonVariants({ variant: "outline", size: "sm" })

/** A ficha do lugar no app/site do Google Maps, em outra aba. */
export function OpenInMapsLink({ target, className }: { target: MapsTarget; className?: string }) {
  return (
    <a
      href={mapsPlaceUrl(target)}
      target="_blank"
      rel="noopener noreferrer"
      title={`Abrir “${target.address}” no Google Maps`}
      className={cn(LINK_CLASS, className)}
    >
      <MapPin /> Abrir no Maps
    </a>
  )
}

/** A rota até o lugar no Google Maps, saindo de `origin` quando houver. */
export function DirectionsLink({
  target,
  origin,
  travelMode,
  className,
}: {
  target: MapsTarget
  origin?: LatLng | null
  travelMode?: TravelMode
  className?: string
}) {
  return (
    <a
      href={mapsDirectionsUrl({ destination: target, origin, travelMode })}
      target="_blank"
      rel="noopener noreferrer"
      title={`Como chegar a “${target.address}”`}
      className={cn(LINK_CLASS, className)}
    >
      <Navigation /> Como chegar
    </a>
  )
}

/** O Mapa do Vitrine já com o pino deste item em foco. */
export function VitrineMapLink({ entryId, className }: { entryId: string; className?: string }) {
  return (
    <Link href={`/mapa?item=${entryId}`} className={cn(LINK_CLASS, className)}>
      <MapIcon /> Ver no mapa do Vitrine
    </Link>
  )
}
