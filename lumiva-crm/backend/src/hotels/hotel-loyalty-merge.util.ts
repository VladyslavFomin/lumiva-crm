import { EntityManager, In } from 'typeorm';
import { HotelLoyaltyMember, HotelLoyaltyStay, HotelLoyaltyTx } from './hotel-loyalty.entities';

/**
 * Слияние профилей гостя: участие в программах переезжает на основной профиль (баллы, проживания и движения
 * складываются). Вызывается внутри транзакции слияния профилей — ДО удаления исходных (иначе каскад сотрёт баллы).
 */
export async function mergeLoyaltyMembers(m: EntityManager, tenantId: string, targetId: string, sourceIds: string[]) {
  const members: HotelLoyaltyMember[] = await m.find(HotelLoyaltyMember, { where: { tenantId, profileId: In([targetId, ...sourceIds]) } });
  const byProgram = new Map<string, HotelLoyaltyMember[]>();
  for (const x of members) byProgram.set(x.programId, [...(byProgram.get(x.programId) || []), x]);
  for (const list of byProgram.values()) {
    const keep = list.find((x) => x.profileId === targetId) || list[0];
    for (const x of list) {
      if (x.id === keep.id) continue;
      keep.points += x.points;
      keep.pendingPoints += x.pendingPoints;
      keep.lifetimePoints += x.lifetimePoints;
      if (x.lastActivityAt && (!keep.lastActivityAt || x.lastActivityAt > keep.lastActivityAt)) keep.lastActivityAt = x.lastActivityAt;
      await m.update(HotelLoyaltyTx, { memberId: x.id }, { memberId: keep.id });
      await m.update(HotelLoyaltyStay, { memberId: x.id }, { memberId: keep.id });
      await m.delete(HotelLoyaltyMember, { id: x.id });
    }
    keep.profileId = targetId;
    await m.save(HotelLoyaltyMember, keep);
  }
}
