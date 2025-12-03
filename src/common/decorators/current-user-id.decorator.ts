import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

interface RequestWithUser extends Request {
    user?: { id?: string | number };
}

export const CurrentUserId = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext) => {
        const req = ctx.switchToHttp().getRequest<RequestWithUser>();
        return req?.user?.id ?? null;
    },
);
