import { RequestHandler } from 'express';

import { requestMiddleware } from '../../middleware';
import { userService } from '../../services';

const oauth: RequestHandler = async (req, res) => {
  const user = userService.oauth(req.body.code, req.body.state);

  res.send(user);
};

export default requestMiddleware(oauth);
