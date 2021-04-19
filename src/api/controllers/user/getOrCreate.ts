import { RequestHandler } from 'express';
import Joi from '@hapi/joi';

import { getConnection, User } from '../../../db';
import requestMiddleware from '../../middleware/request-middleware';

export const addUserSchema = Joi.object().keys({
  address: Joi.string().required(),
});

const getOrCreate: RequestHandler = async (req, res) => {
  const { address } = req.body;
  const manager = getConnection().createEntityManager();

  let user = await manager.findOne(User, { where: { address }, relations: ['operators'] });

  if (!user) {
    user = await getConnection()
      .createEntityManager()
      .save(User, {} as User);
  }

  res.send({});
};

export default requestMiddleware(getOrCreate, { validation: { body: addUserSchema } });
