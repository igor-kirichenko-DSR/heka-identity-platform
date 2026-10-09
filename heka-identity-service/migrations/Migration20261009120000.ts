import { Migration } from '@mikro-orm/migrations';

// DID hierarchy and accreditation credentials (phases 9.2, 9.3 and 7 of docs/role-model-and-oidc-providers.md):
// - `wallet.designated_dids`: the DID of each method a wallet's children name as parent. Existing wallets get it on
//   first use (their oldest DID of the method), so no data is migrated here;
// - `did_link`: the parent of each DID an OrgAdmin or Issuer creates;
// - `token_status_list` and `accreditation`: the accreditation SD-JWT VCs and their IETF Token Status Lists.
export class Migration20261009120000 extends Migration {

  async up(): Promise<void> {
    this.addSql('alter table "wallet" add column "designated_dids" jsonb null;');

    this.addSql('create table "did_link" ("id" varchar(255) not null, "did" varchar(255) not null, "method" varchar(255) not null, "wallet_id" varchar(255) not null, "role" varchar(255) not null, "org_id" varchar(255) null, "parent_wallet_id" varchar(255) not null, "parent_did" varchar(255) null, "controller_declared" boolean not null, "created_at" timestamptz not null, constraint "did_link_pkey" primary key ("id"));');
    this.addSql('alter table "did_link" add constraint "did_link_did_unique" unique ("did");');
    this.addSql('create index "did_link_wallet_id_index" on "did_link" ("wallet_id");');
    this.addSql('create index "did_link_parent_wallet_id_index" on "did_link" ("parent_wallet_id");');

    this.addSql('create table "token_status_list" ("id" varchar(255) not null, "wallet_id" varchar(255) not null, "issuer_did" varchar(255) not null, "size" int not null, "last_index" int not null, "list" text not null, constraint "token_status_list_pkey" primary key ("id"));');
    this.addSql('create index "token_status_list_wallet_id_index" on "token_status_list" ("wallet_id");');
    this.addSql('create index "token_status_list_issuer_did_index" on "token_status_list" ("issuer_did");');

    this.addSql('create table "accreditation" ("id" varchar(255) not null, "subject_did" varchar(255) not null, "subject_wallet_id" varchar(255) not null, "issuer_did" varchar(255) not null, "issuer_wallet_id" varchar(255) not null, "org_id" varchar(255) not null, "accredited_role" varchar(255) not null, "credential" text not null, "status_list_id" varchar(255) not null, "status_index" int not null, "valid_from" timestamptz not null, "valid_until" timestamptz not null, "revoked_at" timestamptz null, "revocation_reason" varchar(255) null, constraint "accreditation_pkey" primary key ("id"));');
    this.addSql('create index "accreditation_subject_did_index" on "accreditation" ("subject_did");');
    this.addSql('create index "accreditation_subject_wallet_id_index" on "accreditation" ("subject_wallet_id");');
    this.addSql('create index "accreditation_issuer_wallet_id_index" on "accreditation" ("issuer_wallet_id");');
    this.addSql('alter table "accreditation" add constraint "accreditation_status_list_id_foreign" foreign key ("status_list_id") references "token_status_list" ("id") on update cascade;');
  }

  async down(): Promise<void> {
    this.addSql('drop table if exists "accreditation" cascade;');
    this.addSql('drop table if exists "token_status_list" cascade;');
    this.addSql('drop table if exists "did_link" cascade;');
    this.addSql('alter table "wallet" drop column "designated_dids";');
  }

}
