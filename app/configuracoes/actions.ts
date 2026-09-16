"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { fail, failValidation, ok, type ActionResult } from "@/lib/actions/result"
import { createClient } from "@/lib/supabase/server"
import { requireUser } from "@/lib/queries/session"

const profileSchema = z.object({
  displayName: z.string().trim().max(80, "Nome muito longo."),
  username: z
    .string()
    .trim()
    .min(3, "O nome de usuário precisa de pelo menos 3 caracteres.")
    .max(30, "Nome de usuário muito longo.")
    .regex(/^[a-z0-9_]+$/, "Use só letras minúsculas, números e _."),
  avatarUrl: z.string().trim().max(2048).nullable(),
})

export async function updateProfileAction(input: {
  displayName: string
  username: string
  avatarUrl: string | null
}): Promise<ActionResult> {
  const parsed = profileSchema.safeParse({
    ...input,
    username: input.username.trim().toLowerCase(),
  })
  if (!parsed.success) return failValidation(parsed.error.issues)

  const user = await requireUser()
  const supabase = await createClient()

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName || null,
      username: parsed.data.username,
      avatar_url: parsed.data.avatarUrl || null,
    })
    .eq("id", user.id)

  if (error) return fail(error)

  revalidatePath("/", "layout")
  return ok()
}
