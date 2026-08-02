/* Copyright (c) 2026, Oracle and/or its affiliates. */

/******************************************************************************
 *
 * This software is dual-licensed to you under the Universal Permissive License
 * (UPL) 1.0 as shown at https://oss.oracle.com/licenses/upl and Apache License
 * 2.0 as shown at http://www.apache.org/licenses/LICENSE-2.0. You may choose
 * either license.
 *
 * If you elect to accept the software under the Apache License, Version 2.0,
 * the following applies:
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * NAME
 *   dbobject.js
 *
 * DESCRIPTION
 *   Tests the use of Oracle database objects.
 *   The default number of dbobject attributes is 101. The number of
 *   attributes can be passed as an argument while running the program.
 *   Derived from https://github.com/oracle/node-oracledb/issues/1782.
 *
 *
 *****************************************************************************/

'use strict';

Error.stackTraceLimit = 50;

const oracledb = require('oracledb');
const dbConfig = require('./dbconfig.js');

// This example runs in both node-oracledb Thin and Thick modes.
//
// Optionally run in node-oracledb Thick mode
if (process.env.NODE_ORACLEDB_DRIVER_MODE === 'thick') {

  // Thick mode requires Oracle Client or Oracle Instant Client libraries.
  // On Windows and macOS you can specify the directory containing the
  // libraries at runtime or before Node.js starts.  On other platforms (where
  // Oracle libraries are available) the system library search path must always
  // include the Oracle library path before Node.js starts.  If the search path
  // is not correct, you will get a DPI-1047 error.  See the node-oracledb
  // installation documentation.
  let clientOpts = {};
  // On Windows and macOS platforms, set the environment variable
  // NODE_ORACLEDB_CLIENT_LIB_DIR to the Oracle Client library path
  if (process.platform === 'win32' || process.platform === 'darwin') {
    clientOpts = { libDir: process.env.NODE_ORACLEDB_CLIENT_LIB_DIR };
  }
  oracledb.initOracleClient(clientOpts);  // enable node-oracledb Thick mode
}

console.log(oracledb.thin ? 'Running in thin mode' : 'Running in thick mode');

async function run() {
  const N = parseInt(process.argv[2] || '101', 10);
  const TYPE_NAME = 'NODB_DB_OBJ';

  let conn;
  try {
    const attrList = Array.from({ length: N }, (_, i) => `A${i + 1} NUMBER`).join(', ');

    conn = await oracledb.getConnection(dbConfig);
    await conn.execute(`CREATE OR REPLACE TYPE ${TYPE_NAME} AS OBJECT (${attrList})`);

    const cls = await conn.getDbObjectClass(TYPE_NAME);
    const names = Object.keys(cls.prototype.attributes);
    console.log('getDbObjectClass reports', names.length, 'attributes | last:', names[names.length - 1]);

    const r = await conn.execute(
      `DECLARE v ${TYPE_NAME}; BEGIN v := :o; :ret := v.A1; END;`,
      {
        o: { type: TYPE_NAME, val: { A1: 42 } },
        ret: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
      },
    );
    console.log('bind: OK — round-tripped A1 =', r.outBinds.ret);
  } catch (err) {
    console.error(err);
  } finally {
    if (conn) {
      try {
        await conn.execute(
          `DECLARE
          e_type_missing EXCEPTION;
          PRAGMA EXCEPTION_INIT(e_type_missing, -4043);
          BEGIN
          EXECUTE IMMEDIATE ('DROP TYPE ${TYPE_NAME} FORCE');
          EXCEPTION
          WHEN e_type_missing THEN NULL;
          END;`
        );
        await conn.close();
      } catch (err) {
        console.error(err);
      }
    }
  }
}

run();
