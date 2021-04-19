import { RequestHandler } from 'express';

import requestMiddleware from '../../middleware/request-middleware';
import { RequestWithAuth } from '../../types';

const list: RequestHandler = async (req: RequestWithAuth, res) => {
  const { page = 1, limit = 20 } = req.query;
  // const { items, total } = await getDepositsForAddress(req.authenticatedAddress, Number(page), Number(limit));

  res.send({
    items: [],
    total: 1,
  });
};

// async function getDepositsForAddress(
//   address: string,
//   page = 1,
//   limit = 20
// ): Promise<{ items: Deposit[]; total: number }> {
//   const connection = getConnection();
//   const q = connection
//     .createQueryBuilder()
//     .select(
//       // eslint-disable-next-line max-len
//       '"createdAt", "depositAddress", "lotSizeSatoshis", "status", "systemStatus", "redemptionCostEthEquivalentWithFee" as "redemptionCost"'
//     )
//     .from(Deposit, 'd');
//   const subq = q
//     .subQuery()
//     .select('1')
//     .from(User, 'u')
//     .innerJoin('u.operators', 'o')
//     .innerJoin('o.deposits', 'd2')
//     .where('d.id = d2.id')
//     .andWhere('(d.status in (:...statuses) OR d."systemStatus" is not null)', {
//       statuses: [Deposit.Status[Deposit.Status.ACTIVE]],
//     })
//     .andWhere('u.address = :address', { address })
//     .andWhere('d."lotSizeSatoshis" >= :minLotSize', { minLotSize })
//     .andWhere('d."lotSizeSatoshis" <= :maxLotSize', { maxLotSize });

//   const offset = limit * (page - 1);

//   const rawItems = await q
//     .andWhere(`exists ${subq.getQuery()}`)
//     .addOrderBy('d."systemStatus"', 'ASC', 'NULLS LAST')
//     .addOrderBy('d.status', 'DESC')
//     .addOrderBy('d."createdAt"', 'DESC')
//     .limit(limit)
//     .offset(offset)
//     .execute();
//   const total = await q.andWhere(`exists ${subq.getQuery()}`).getCount();

//   // merge deposit status with system status for the UI
//   const items = rawItems.map((item: any) => {
//     // eslint-disable-next-line no-param-reassign
//     item.status = item.systemStatus ? `KEEPER_${item.systemStatus}` : item.status;
//     return item;
//   });

//   return { items, total };
// }

export default requestMiddleware(list);
