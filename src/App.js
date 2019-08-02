// @flow

import React, { Component } from "react";
import GraphiQL from "graphiql";
import GraphiQLExplorer from "graphiql-explorer";
import { buildClientSchema, getIntrospectionQuery, parse } from "graphql";

import { makeDefaultArg, getDefaultScalarArgValue } from "./CustomArgs";

import "graphiql/graphiql.css";
import "./App.css";

import type { GraphQLSchema } from "graphql";

function fetcher(params: Object): Object {
  return fetch(
    "https://api.staging.aboundcare.com/graphql",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Authorization": "Bearer eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJ3aWxzb24iLCJleHAiOjE1NzA2MjU1MzIsImlhdCI6MTU2NDU3NzUzMiwiaXNzIjoid2lsc29uIiwianRpIjoiMjIxNDJjNjQtNmEyYi00MmNjLWJmNDctMDA4N2E0ZjM1YjI5IiwibmJmIjoxNTY0NTc3NTMxLCJzdWIiOiJjb2FjaDo1MyIsInR5cCI6ImFjY2VzcyJ9.xM2QMwPP7iJEGCFpj3Xn-grNlTAZ2MoEyucLITj6V1H9ini1RIU09UVGC1ljFs6CcbAVk8U5Yxe3_0OhnNHnzA"
      },
      body: JSON.stringify(params)
    }
  )
    .then(function(response) {
      return response.text();
    })
    .then(function(responseBody) {
      try {
        return JSON.parse(responseBody);
      } catch (e) {
        return responseBody;
      }
    });
}

const DEFAULT_QUERY = `# shift-option/alt-click on a query below to jump to it in the explorer
# option/alt-click on a field in the explorer to select all subfields
query LoadPatients($includeInactive: Boolean) {
  coach: currentUser {
    ... on Coach {
      id
      patients(includeInactive: $includeInactive) {
        ...patientFields
        __typename
      }
      __typename
    }
    __typename
  }
}

fragment patientFields on Patient {
  id
  name
  dateOfBirth
  height
  weight
  timezone
  isInactive
  phoneNumber
  email
  coachChat {
    id
    __typename
  }
  summary {
    ...PatientSummaryFields
    __typename
  }
  engagement {
    ...PatientEngagementFields
    __typename
  }
  __typename
}

fragment PatientSummaryFields on PatientSummary {
  dailyBgHigh {
    ...BloodGlucoseFields
    __typename
  }
  dailyBgLow {
    ...BloodGlucoseFields
    __typename
  }
  medications
  targetRangePercentage {
    high
    inRange
    low
    criticalLow
    __typename
  }
  weeklyBgHigh {
    ...BloodGlucoseFields
    __typename
  }
  weeklyBgLow {
    ...BloodGlucoseFields
    __typename
  }
  __typename
}

fragment PatientEngagementFields on PatientEngagement {
  minutesSinceLastBgReading
  minutesSinceLastBurstActivity
  minutesSinceLastMessage
  minutesSinceViewedExplorableAssignment
  score
  __typename
}

fragment BloodGlucoseFields on BloodGlucoseBody {
  sequenceNumber
  measuredAt
  mealMarker
  glucoseConcentration
  glucoseConcentrationUnits
  notes
  targetRangeAssessment
  __typename
}`;

type State = {
  schema: ?GraphQLSchema,
  query: string,
  explorerIsOpen: boolean
};

class App extends Component<{}, State> {
  _graphiql: GraphiQL;
  state = { schema: null, query: DEFAULT_QUERY, explorerIsOpen: true };

  componentDidMount() {
    fetcher({
      query: getIntrospectionQuery()
    }).then(result => {
      const editor = this._graphiql.getQueryEditor();
      editor.setOption("extraKeys", {
        ...(editor.options.extraKeys || {}),
        "Shift-Alt-LeftClick": this._handleInspectOperation
      });

      this.setState({ schema: buildClientSchema(result.data) });
    });
  }

  _handleInspectOperation = (
    cm: any,
    mousePos: { line: Number, ch: Number }
  ) => {
    const parsedQuery = parse(this.state.query || "");

    if (!parsedQuery) {
      console.error("Couldn't parse query document");
      return null;
    }

    var token = cm.getTokenAt(mousePos);
    var start = { line: mousePos.line, ch: token.start };
    var end = { line: mousePos.line, ch: token.end };
    var relevantMousePos = {
      start: cm.indexFromPos(start),
      end: cm.indexFromPos(end)
    };

    var position = relevantMousePos;

    var def = parsedQuery.definitions.find(definition => {
      if (!definition.loc) {
        console.log("Missing location information for definition");
        return false;
      }

      const { start, end } = definition.loc;
      return start <= position.start && end >= position.end;
    });

    if (!def) {
      console.error(
        "Unable to find definition corresponding to mouse position"
      );
      return null;
    }

    var operationKind =
      def.kind === "OperationDefinition"
        ? def.operation
        : def.kind === "FragmentDefinition"
        ? "fragment"
        : "unknown";

    var operationName =
      def.kind === "OperationDefinition" && !!def.name
        ? def.name.value
        : def.kind === "FragmentDefinition" && !!def.name
        ? def.name.value
        : "unknown";

    var selector = `.graphiql-explorer-root #${operationKind}-${operationName}`;

    var el = document.querySelector(selector);
    el && el.scrollIntoView();
  };

  _handleEditQuery = (query: string): void => this.setState({ query });

  _handleToggleExplorer = () => {
    this.setState({ explorerIsOpen: !this.state.explorerIsOpen });
  };

  render() {
    const { query, schema } = this.state;
    return (
      <div className="graphiql-container">
        <GraphiQLExplorer
          schema={schema}
          query={query}
          onEdit={this._handleEditQuery}
          onRunOperation={operationName =>
            this._graphiql.handleRunQuery(operationName)
          }
          explorerIsOpen={this.state.explorerIsOpen}
          onToggleExplorer={this._handleToggleExplorer}
          getDefaultScalarArgValue={getDefaultScalarArgValue}
          makeDefaultArg={makeDefaultArg}
        />
        <GraphiQL
          ref={ref => (this._graphiql = ref)}
          fetcher={fetcher}
          schema={schema}
          query={query}
          onEditQuery={this._handleEditQuery}
        >
          <GraphiQL.Toolbar>
            <GraphiQL.Button
              onClick={() => this._graphiql.handlePrettifyQuery()}
              label="Prettify"
              title="Prettify Query (Shift-Ctrl-P)"
            />
            <GraphiQL.Button
              onClick={() => this._graphiql.handleToggleHistory()}
              label="History"
              title="Show History"
            />
            <GraphiQL.Button
              onClick={this._handleToggleExplorer}
              label="Explorer"
              title="Toggle Explorer"
            />
          </GraphiQL.Toolbar>
        </GraphiQL>
      </div>
    );
  }
}

export default App;
