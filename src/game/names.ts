// Noms d'affichage des versions (séparé de daily.ts pour ne pas charger le moteur au démarrage). Getters : suivent la langue.
import { t } from '../i18n'

export const GAME_NAMES: Record<string, string> = {
  get red() { return t('game.red') },
  get crystal() { return t('game.crystal') },
  get emerald() { return t('game.emerald') },
  get platinum() { return t('game.platinum') },
  get black2() { return t('game.black2') },
}
