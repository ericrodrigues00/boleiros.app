export type GroupResult = {
  groupId: string
  firstTeamId: string | null
  secondTeamId: string | null
  thirdTeamId: string | null
  advancingAsThird: boolean
}

export function buildResultLookup(groupResults: GroupResult[]) {
  const byGroupId = new Map(groupResults.map((r) => [r.groupId, r]))
  const advancingThirdIds = new Set(
    groupResults
      .filter((r) => r.advancingAsThird && r.thirdTeamId)
      .map((r) => r.thirdTeamId as string),
  )
  return { byGroupId, advancingThirdIds }
}

export function isFirstCorrect(groupId: string, teamId: string, groupResults: GroupResult[]): boolean {
  const result = buildResultLookup(groupResults).byGroupId.get(groupId)
  return !!result?.firstTeamId && result.firstTeamId === teamId
}

export function isSecondCorrect(groupId: string, teamId: string, groupResults: GroupResult[]): boolean {
  const result = buildResultLookup(groupResults).byGroupId.get(groupId)
  return !!result?.secondTeamId && result.secondTeamId === teamId
}

export function isThirdAdvancing(teamId: string, groupResults: GroupResult[]): boolean {
  return buildResultLookup(groupResults).advancingThirdIds.has(teamId)
}

export function hasAnyGroupResults(groupResults: GroupResult[]): boolean {
  return groupResults.some((r) => r.firstTeamId && r.secondTeamId)
}
