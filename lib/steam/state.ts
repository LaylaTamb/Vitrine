/**
 * O "estado" do login da Steam: um valor aleatório num cookie httpOnly que
 * tem que voltar igual na URL de retorno. Sem ele, um link forjado poderia
 * ligar a conta Steam de outra pessoa ao seu perfil (ou o contrário).
 */
export const STEAM_STATE_COOKIE = "vitrine_steam_estado"
export const STEAM_STATE_PATH = "/api/steam"
export const STEAM_STATE_MAX_AGE = 10 * 60
