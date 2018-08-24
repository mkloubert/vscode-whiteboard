/**
 * This file is part of the vscode-whiteboard distribution.
 * Copyright (c) e.GO Digital GmbH, Aachen, Germany (https://www.e-go-digital.com/)
 *
 * vscode-whiteboard is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation, version 3.
 *
 * vscode-whiteboard is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import * as _ from 'lodash';
import * as vscode from 'vscode';
import * as vscode_helpers from 'vscode-helpers';

/**
 * Options for connecting to a whiteboard.
 */
export interface WhiteboardConnectionOptions {
    /**
     * The host address.
     */
    host?: string;
    /**
     * The TCP port.
     */
    port?: number;
    /**
     * Use secure HTTP or not.
     */
    secure?: boolean;
}

/**
 * A whiteboard (connection).
 */
export class Whiteboard {
    private constructor(public readonly baseUrl: vscode.Uri) {
    }

    /**
     * Connects to a board.
     *
     * @param {WhiteboardConnectionOptions} [opts] The custom options.
     *
     * @return {Promise<Whiteboard>} The promise with the new instance.
     */
    public static async connect(opts?: WhiteboardConnectionOptions): Promise<Whiteboard> {
        if (_.isNil(opts)) {
            opts = <any>{};
        }

        let host = vscode_helpers.toStringSafe(opts.host).trim();
        if ('' === host) {
            host = 'localhost';
        }

        let port = parseInt(
            vscode_helpers.toStringSafe(opts.port).trim()
        );

        let secure = vscode_helpers.toBooleanSafe(opts.secure);
        if (isNaN(port)) {
            port = secure ? 443 : 80;
        }

        const BASE_URI = vscode.Uri.parse(
            `http${ secure ? 's' : '' }://${ host }:${ port }/api/`
        );

        const TEST_RESPONSE = await vscode_helpers.GET(BASE_URI);
        if ('whiteboard' !== vscode_helpers.normalizeString(TEST_RESPONSE.response.headers['x-ego'])) {
            throw new Error('No whiteboard host');
        }

        return new Whiteboard(BASE_URI);
    }

    /**
     * Returns the current content of the board.
     *
     * @return {Promise<Buffer>|null} The promise with the content.
     */
    public async getContent() {
        const RESPONSE = await vscode_helpers.GET(this.baseUrl);

        switch (RESPONSE.code) {
            case 200:
                return await RESPONSE.readBody();

            case 204:
                return null;
        }

        throw new Error(`Unexpected response code '${ RESPONSE.code }'`);
    }

    /**
     * Sets the content of the board.
     *
     * @param [any} content The new content for the board.
     */
    public async setContent(content: any) {
        if (_.isNil(content)) {
            content = Buffer.alloc(0);
        }

        content = await vscode_helpers.asBuffer(content, 'utf8');

        const RESPONSE = await vscode_helpers.PUT(this.baseUrl, content);
        if (204 !== RESPONSE.code) {
            throw new Error(`Unexpected response code '${ RESPONSE.code }'`);
        }
    }
}
