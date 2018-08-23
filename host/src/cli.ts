/**
 * This file is part of the @egodigital/whiteboard distribution.
 * Copyright (c) e.GO Digital GmbH, Aachen, Germany (https://www.e-go-digital.com/)
 *
 * @egodigital/whiteboard is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation, version 3.
 *
 * @egodigital/whiteboard is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import * as egoose from '@egodigital/egoose';
import * as whiteboard from './host';

(async () => {
    const OPTIONS: whiteboard.WhiteboardHostOptions = {
        hostname: process.env.WHITEBOARD_HOST,
        port: parseInt(egoose.toStringSafe(process.env.WHITEBOARD_PORT).trim()),
    };

    const HOST = new whiteboard.WhiteboardHost(OPTIONS);

    await HOST.start();
})();