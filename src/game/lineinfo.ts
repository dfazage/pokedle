// Informations de famille évolutive / taille, utilisées pour générer les sprites originaux.
export function lineInfo(dex: any, sp: any) {
  let root = sp
  let stage = 0
  while (root.prevo) {
    root = dex.species.get(root.prevo)
    stage++
  }
  const bs = sp.baseStats
  return {
    num: sp.num as number,
    root: root.num as number,
    stage,
    heightm: 0.35 * Math.cbrt((sp.weightkg as number) || 10), // taille approchée via le poids (heightm absent du dex)
    bst: (bs.hp + bs.atk + bs.def + bs.spa + bs.spd + bs.spe) as number,
  }
}
