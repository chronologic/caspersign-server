import { RequestHandler } from 'express';

import { requestMiddleware } from '../../middleware';
import { userService } from '../../services';

const oauth: RequestHandler = async (req, res) => {
  const user = await userService.oauth(req.body.code, req.body.state);

  console.log('$$$$$$$$$$$$$$$$ pre response', user);

  res.send(user);
};

export default requestMiddleware(oauth);
