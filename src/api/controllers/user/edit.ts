import { RequestHandler } from 'express';
import Joi from '@hapi/joi';
import { Deposit, getConnection, Operator, User } from 'keeper-db';

import requestMiddleware from '../../middleware/request-middleware';
import BadRequest from '../../errors/bad-request';
import { BigNumber } from 'ethers';

export const editSchema = Joi.object().keys({
  email: Joi.string().optional(),
  operatorAddress: Joi.string().optional(),
});

const edit: RequestHandler = async (req, res) => {
  const { address } = req.params;
  const { operatorAddress, email } = req.body;
  const manager = getConnection().createEntityManager();

  const user = await manager.findOne(User, { where: { address }, relations: ['operators'] });

  if (!user) {
    throw new BadRequest('User does not exist');
  }

  if (typeof email !== 'undefined') {
    user.email = email;
  }

  if (operatorAddress === null || operatorAddress === '') {
    user.operators = [];
  } else if (typeof operatorAddress !== 'undefined') {
    if (await hasDepositsBeingProcessed(user.id)) {
      throw new BadRequest('Cannot update operator address while its deposits are being processed');
    }

    let operator = await manager.findOne(Operator, {
      where: { address: operatorAddress },
    });

    if (!operator) {
      operator = await manager.save(Operator, { address: operatorAddress } as Operator);
    }

    user.operators = [operator];
  }

  await manager.save(User, user);

  res.send({
    address: user.address,
    email: user.email,
    balanceEth: BigNumber.from(user.balanceEth || 0).toString(),
    operatorAddress: user.operators[0]?.address || null,
  });
};

async function hasDepositsBeingProcessed(userId: number): Promise<boolean> {
  const count = await getConnection()
    .createQueryBuilder()
    .select('1')
    .from(User, 'u')
    .innerJoin('u.operators', 'o')
    .innerJoin('o.deposits', 'd')
    .where('u.id = :userId', { userId })
    .andWhere('d."systemStatus" in (:...statuses)', {
      statuses: [Deposit.SystemStatus.QUEUED_FOR_REDEMPTION, Deposit.SystemStatus.REDEEMING],
    })
    .getCount();

  return count > 0;
}

export default requestMiddleware(edit, { validation: { body: editSchema } });
