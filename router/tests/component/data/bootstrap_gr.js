var common_stmts = require("common_statements");
var gr_memberships = require("gr_memberships");

if (mysqld.global.gr_node_host === undefined) {
  mysqld.global.gr_node_host = "127.0.0.1";
}

if (mysqld.global.cluster_nodes === undefined) {
  mysqld.global.cluster_nodes =
      [["uuid-1", 5500], ["uuid-2", 5510], ["uuid-3", 5520]];
}

if (mysqld.global.gr_nodes === undefined) {
  mysqld.global.gr_nodes = [
    ["uuid-1", 5500, "ONLINE"], ["uuid-2", 5510, "ONLINE"],
    ["uuid-3", 5520, "ONLINE"]
  ];
}

if (mysqld.global.cluster_name == undefined) {
  mysqld.global.cluster_name = "mycluster";
}

if (mysqld.global.metadata_schema_version === undefined) {
  mysqld.global.metadata_schema_version = [2, 2, 0];
}

if (mysqld.global.gr_id === undefined) {
  mysqld.global.gr_id = "cluster-specific-id";
}

var members = gr_memberships.gr_members(
    mysqld.global.gr_node_host, mysqld.global.gr_nodes);

const online_gr_nodes = members
                            .filter(function(memb, indx) {
                              return (memb[3] === "ONLINE");
                            })
                            .length;

const recovering_gr_nodes = members
                                .filter(function(memb, indx) {
                                  return (memb[3] === "RECOVERING");
                                })
                                .length;

var options = {
  metadata_schema_version: mysqld.global.metadata_schema_version,
  cluster_type: "gr",
  gr_id: mysqld.global.gr_id,
  clusterset_present: 0,
  innodb_cluster_name: mysqld.global.cluster_name,
  innodb_cluster_instances: gr_memberships.cluster_nodes(
      mysqld.global.gr_node_host, mysqld.global.cluster_nodes),
  gr_members_all: members.length,
  gr_members_online: online_gr_nodes,
  gr_members_recovering: recovering_gr_nodes,
};

var common_responses = common_stmts.prepare_statement_responses(
    [
      "router_set_session_options",
      "router_set_gr_consistency_level",
      "router_select_schema_version",
      "router_select_cluster_type_v2",
      "router_select_current_instance_attributes",
      "router_count_clusters_v2",
      "router_check_member_state",
      "router_select_members_count",
      "router_select_replication_group_name",
      "router_show_cipher_status",
      "router_select_cluster_instances_v2_gr",
      "router_start_transaction",
      "router_commit",

      // account verification
      "router_select_metadata_v2_gr_account_verification",
      "router_select_group_membership",
    ],
    options);

var common_responses_v2_1 = common_stmts.prepare_statement_responses(
    [
      "router_clusterset_present",
    ],
    options);

var common_responses_regex = common_stmts.prepare_statement_responses_regex(
    [
      "router_insert_into_routers",
      "router_create_user_if_not_exists",
      "router_check_auth_plugin",
      "router_grant_on_metadata_db",
      "router_grant_on_pfs_db",
      "router_grant_on_routers",
      "router_grant_on_v2_routers",
      "router_update_routers_in_metadata",
      "router_update_router_options_in_metadata",
    ],
    options);

({
  handshake: {
    auth: {
      username: "root",
      password: "fake-pass",
    }
  },
  stmts: function(stmt) {
    var res;
    if (common_responses.hasOwnProperty(stmt)) {
      return common_responses[stmt];
    }
    // metadata ver 2.1+
    else if (
        (mysqld.global.metadata_schema_version[0] >= 2 &&
         mysqld.global.metadata_schema_version[1] >= 1) &&
        common_responses_v2_1.hasOwnProperty(stmt)) {
      return common_responses_v2_1[stmt];
    } else if (
        (res = common_stmts.handle_regex_stmt(stmt, common_responses_regex)) !==
        undefined) {
      return res;
    } else {
      return common_stmts.unknown_statement_response(stmt);
    }
  }
})
