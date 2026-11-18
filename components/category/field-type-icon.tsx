import {
  Calculator,
  Calendar,
  Coins,
  Hash,
  List,
  MapPin,
  Star,
  Timer,
  Type,
  type LucideIcon,
} from "lucide-react"

import type { FieldType } from "@/lib/domain/types"

/** O ícone de cada tipo de campo: na lista de campos e nos botões de tipo. */
export const FIELD_TYPE_ICONS: Record<FieldType, LucideIcon> = {
  str: Type,
  int: Hash,
  decimal: Calculator,
  date: Calendar,
  time: Timer,
  currency: Coins,
  select: List,
  star: Star,
  location: MapPin,
}
