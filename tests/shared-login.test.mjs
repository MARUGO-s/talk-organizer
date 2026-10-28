import test from 'node:test';
import assert from 'node:assert/strict';
import {isSharedLoginId, SHARED_ACCOUNT_EMAIL} from '../docs/shared-login.mjs';
test('共通IDだけをアプリ専用の認証先として受け付ける',()=>{
 assert.equal(isSharedLoginId('marugo'),true);
 assert.equal(isSharedLoginId(' MARUGO '),true);
 assert.equal(isSharedLoginId('another'),false);
 assert.equal(isSharedLoginId('marugo@example.com'),false);
 assert.equal(isSharedLoginId(null),false);
 assert.equal(SHARED_ACCOUNT_EMAIL,'talk-organizer-marugo@example.com');
});
