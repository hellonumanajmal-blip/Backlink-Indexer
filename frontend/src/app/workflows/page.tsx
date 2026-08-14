"use client";

import React, { useState, useEffect } from "react";
import {
  Workflow,
  Play,
  Plus,
  Zap,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Layers,
  History,
  FileText,
  Activity,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Search,
  Filter,
  Check,
  X
} from "lucide-react";

interface WorkflowItem {
  id: string;
  name: string;
  description: string;
  status: string;
  version: number;
  is_active: boolean;
  triggers: any[];
  conditions: any[];
  actions: any[];
}

interface WorkflowTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  triggers_config: any[];
  conditions_config: any[];
  actions_config: any[];
}

interface ExecutionItem {
  id: string;
  workflow_id: string;
  trigger_type: string;
  status: string;
  duration_ms: number;
  started_at: string;
  error_message?: string;
}

export default function WorkflowsPage() {
  const [activeTab, setActiveTab] = useState<"designer" | "executions" | "templates" | "events" | "simulator">("designer");
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([
    {
      id: "wf_001",
      name: "Auto Verification & Re-indexing",
      description: "Triggered on discovery to verify indexing status and submit unindexed pages.",
      status: "Active",
      version: 1,
      is_active: true,
      triggers: [{ trigger_type: "Immediate", event_source: "BacklinkCreated" }],
      conditions: [{ field: "status", operator: "equals", value: "Pending" }],
      actions: [{ action_type: "RunVerification", sequence_order: 1 }, { action_type: "RefreshDiscovery", sequence_order: 2 }]
    },
    {
      id: "wf_002",
      name: "Weekly Executive Client Report Dispatch",
      description: "Generates executive white-label PDFs and emails client stakeholders every Monday.",
      status: "Active",
      version: 2,
      is_active: true,
      triggers: [{ trigger_type: "Scheduled", event_source: "WeeklyCron" }],
      conditions: [],
      actions: [{ action_type: "GenerateReport", sequence_order: 1 }, { action_type: "SendNotification", sequence_order: 2 }]
    }
  ]);

  const [templates, setTemplates] = useState<WorkflowTemplate[]>([
    {
      id: "tpl_01",
      name: "Daily Verification Pipeline",
      category: "Indexing",
      description: "Automatically verifies indexing status for all new target URLs daily.",
      triggers_config: [{ trigger_type: "Scheduled" }],
      conditions_config: [{ field: "status", operator: "equals", value: "Pending" }],
      actions_config: [{ action_type: "RunVerification" }]
    },
    {
      id: "tpl_02",
      name: "Lost Backlink Reclamation Alert",
      category: "Backlinks",
      description: "Detects high-DA lost backlinks and automatically creates outreach reclamation tasks.",
      triggers_config: [{ trigger_type: "Immediate", event_source: "BacklinkLost" }],
      conditions_config: [{ field: "domain_authority", operator: "greater_than", value: 50 }],
      actions_config: [{ action_type: "CreateAlert" }, { action_type: "CreateTask" }]
    }
  ]);

  const [executions, setExecutions] = useState<ExecutionItem[]>([
    {
      id: "exec_101",
      workflow_id: "wf_001",
      trigger_type: "Immediate",
      status: "Completed",
      duration_ms: 142.5,
      started_at: new Date().toISOString()
    },
    {
      id: "exec_102",
      workflow_id: "wf_002",
      trigger_type: "Scheduled",
      status: "Completed",
      duration_ms: 380.2,
      started_at: new Date(Date.now() - 3600000).toISOString()
    }
  ]);

  // Designer State
  const [workflowName, setWorkflowName] = useState("");
  const [workflowDesc, setWorkflowDesc] = useState("");
  const [selectedTrigger, setSelectedTrigger] = useState("Immediate");
  const [selectedEvent, setSelectedEvent] = useState("BacklinkCreated");
  const [conditionField, setConditionField] = useState("status");
  const [conditionOp, setConditionOp] = useState("equals");
  const [conditionVal, setConditionVal] = useState("Pending");
  const [selectedAction, setSelectedAction] = useState("RunVerification");

  // Simulation State
  const [simPayload, setSimPayload] = useState('{\n  "event_type": "BacklinkCreated",\n  "status": "Pending",\n  "domain_authority": 65\n}');
  const [simResult, setSimResult] = useState<any>(null);

  const handleCreateWorkflow = () => {
    if (!workflowName) return;
    const newWf: WorkflowItem = {
      id: `wf_${Date.now()}`,
      name: workflowName,
      description: workflowDesc,
      status: "Active",
      version: 1,
      is_active: true,
      triggers: [{ trigger_type: selectedTrigger, event_source: selectedEvent }],
      conditions: [{ field: conditionField, operator: conditionOp, value: conditionVal }],
      actions: [{ action_type: selectedAction, sequence_order: 1 }]
    };
    setWorkflows([newWf, ...workflows]);
    setWorkflowName("");
    setWorkflowDesc("");
  };

  const handleRunSimulation = () => {
    try {
      const parsed = JSON.parse(simPayload);
      setSimResult({
        simulation_id: `sim_${Date.now()}`,
        is_trigger_matched: true,
        is_condition_passed: parsed.status === conditionVal || parsed.domain_authority > 50,
        actions_evaluated: [
          { action_type: selectedAction, status: "SimulatedSuccess" }
        ],
        logs: [
          "Simulation initialized cleanly.",
          "Trigger matched event input.",
          "Condition rule evaluated successfully.",
          `Action node [${selectedAction}] triggered.`
        ]
      });
    } catch (e) {
      alert("Invalid JSON payload for simulation");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      {/* Header Banner */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm mb-1">
              <Workflow className="w-4 h-4" /> ENTERPRISE AUTOMATION & EVENT ENGINE
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Workflow Builder & Orchestration</h1>
            <p className="text-slate-400 text-sm mt-1">
              Create, simulate, and automate cross-platform SEO workflows, index verification rules, and client deliverables.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab("designer")}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded-lg text-sm transition-all shadow-lg shadow-indigo-500/20"
            >
              <Plus className="w-4 h-4" /> Create Workflow
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-slate-800 mt-6">
          {[
            { id: "designer", label: "Workflow Designer", icon: Sliders },
            { id: "executions", label: "Execution History", icon: History },
            { id: "templates", label: "Template Library", icon: Layers },
            { id: "events", label: "Event Stream", icon: Activity },
            { id: "simulator", label: "Simulation Playground", icon: Sparkles }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                  isActive
                    ? "border-indigo-500 text-indigo-400 bg-indigo-500/10"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto">
        {/* TAB 1: WORKFLOW DESIGNER */}
        {activeTab === "designer" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Visual Builder Form */}
            <div className="lg:col-span-2 space-y-6 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-indigo-400" /> Visual Workflow Canvas
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Workflow Name</label>
                  <input
                    type="text"
                    value={workflowName}
                    onChange={(e) => setWorkflowName(e.target.value)}
                    placeholder="e.g. Automated High-DA Lost Backlink Recovery"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Description</label>
                  <textarea
                    value={workflowDesc}
                    onChange={(e) => setWorkflowDesc(e.target.value)}
                    placeholder="Describe the objective and operational logic of this automation rule..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 h-20"
                  />
                </div>

                {/* Node 1: Trigger */}
                <div className="border border-indigo-500/30 bg-indigo-500/5 rounded-xl p-4 relative">
                  <div className="absolute -top-3 left-4 bg-indigo-600 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded">
                    Step 1: Event Trigger
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Trigger Type</label>
                      <select
                        value={selectedTrigger}
                        onChange={(e) => setSelectedTrigger(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                      >
                        <option value="Immediate">Immediate / Event-Driven</option>
                        <option value="Scheduled">Scheduled / Cron</option>
                        <option value="Threshold">Threshold Metric</option>
                        <option value="Manual">Manual Trigger</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Event Source</label>
                      <select
                        value={selectedEvent}
                        onChange={(e) => setSelectedEvent(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                      >
                        <option value="BacklinkCreated">Backlink Created</option>
                        <option value="BacklinkLost">Backlink Lost</option>
                        <option value="HealthScoreChanged">Health Score Changed</option>
                        <option value="IndexVerified">Index Verified</option>
                        <option value="CampaignCompleted">Campaign Completed</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Connector Arrow */}
                <div className="flex justify-center">
                  <ArrowRight className="w-5 h-5 text-indigo-400 rotate-90" />
                </div>

                {/* Node 2: Condition */}
                <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-xl p-4 relative">
                  <div className="absolute -top-3 left-4 bg-emerald-600 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded">
                    Step 2: Filter Condition
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-2">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Field</label>
                      <input
                        type="text"
                        value={conditionField}
                        onChange={(e) => setConditionField(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Operator</label>
                      <select
                        value={conditionOp}
                        onChange={(e) => setConditionOp(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                      >
                        <option value="equals">equals</option>
                        <option value="not_equals">not_equals</option>
                        <option value="greater_than">greater_than</option>
                        <option value="less_than">less_than</option>
                        <option value="contains">contains</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Value</label>
                      <input
                        type="text"
                        value={conditionVal}
                        onChange={(e) => setConditionVal(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Connector Arrow */}
                <div className="flex justify-center">
                  <ArrowRight className="w-5 h-5 text-emerald-400 rotate-90" />
                </div>

                {/* Node 3: Action */}
                <div className="border border-purple-500/30 bg-purple-500/5 rounded-xl p-4 relative">
                  <div className="absolute -top-3 left-4 bg-purple-600 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded">
                    Step 3: Automated Action
                  </div>
                  <div className="mt-2">
                    <label className="block text-xs text-slate-400 mb-1">Action Type</label>
                    <select
                      value={selectedAction}
                      onChange={(e) => setSelectedAction(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    >
                      <option value="RunVerification">Run Index Verification</option>
                      <option value="RefreshDiscovery">Refresh Discovery Crawler</option>
                      <option value="GenerateReport">Generate White-Label Executive Report</option>
                      <option value="CreateTask">Create CRM Outreach Task</option>
                      <option value="CreateAlert">Create High Priority Alert</option>
                      <option value="SendNotification">Send Email/Slack Notification</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={handleCreateWorkflow}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-lg text-sm transition-all shadow-md shadow-indigo-500/20"
                  >
                    Save & Deploy Workflow Rule
                  </button>
                </div>
              </div>
            </div>

            {/* Configured Workflows List */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Workflow className="w-5 h-5 text-indigo-400" /> Published Workflows
              </h2>

              <div className="space-y-3">
                {workflows.map((wf) => (
                  <div key={wf.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                          <h3 className="font-semibold text-white text-sm">{wf.name}</h3>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{wf.description}</p>
                      </div>
                      <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                        v{wf.version}
                      </span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                      <div className="flex items-center gap-2">
                        <span className="bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded text-[11px]">
                          {wf.triggers[0]?.event_source || wf.triggers[0]?.trigger_type}
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-500" />
                        <span className="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded text-[11px]">
                          {wf.actions[0]?.action_type}
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          const exec: ExecutionItem = {
                            id: `exec_${Date.now()}`,
                            workflow_id: wf.id,
                            trigger_type: wf.triggers[0]?.trigger_type || "Manual",
                            status: "Completed",
                            duration_ms: Math.round(Math.random() * 200 + 50),
                            started_at: new Date().toISOString()
                          };
                          setExecutions([exec, ...executions]);
                          alert(`Workflow [${wf.name}] triggered successfully!`);
                        }}
                        className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium text-xs"
                      >
                        <Play className="w-3 h-3" /> Run
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: EXECUTION HISTORY */}
        {activeTab === "executions" && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-400" /> Execution History Logs
              </h2>
              <button
                onClick={() => setExecutions([...executions])}
                className="flex items-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg"
              >
                <RefreshCw className="w-3 h-3" /> Refresh Logs
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3">Execution ID</th>
                    <th className="p-3">Workflow ID</th>
                    <th className="p-3">Trigger Type</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Duration</th>
                    <th className="p-3">Started At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {executions.map((exec) => (
                    <tr key={exec.id} className="hover:bg-slate-800/30">
                      <td className="p-3 font-mono text-indigo-400">{exec.id}</td>
                      <td className="p-3 font-mono text-slate-300">{exec.workflow_id}</td>
                      <td className="p-3">{exec.trigger_type}</td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-medium">
                          <CheckCircle2 className="w-3 h-3" /> {exec.status}
                        </span>
                      </td>
                      <td className="p-3 font-mono">{exec.duration_ms} ms</td>
                      <td className="p-3 text-slate-400">{new Date(exec.started_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: TEMPLATE LIBRARY */}
        {activeTab === "templates" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((tpl) => (
              <div key={tpl.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-indigo-500/50 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded">
                      {tpl.category}
                    </span>
                    <span className="text-xs text-slate-500">Built-in Template</span>
                  </div>
                  <h3 className="font-semibold text-white text-base">{tpl.name}</h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">{tpl.description}</p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
                  <div className="text-xs text-slate-400">
                    <span className="font-semibold text-slate-200">{tpl.actions_config.length}</span> Automated Actions
                  </div>
                  <button
                    onClick={() => {
                      const imported: WorkflowItem = {
                        id: `wf_${Date.now()}`,
                        name: tpl.name,
                        description: tpl.description,
                        status: "Active",
                        version: 1,
                        is_active: true,
                        triggers: tpl.triggers_config,
                        conditions: tpl.conditions_config || [],
                        actions: tpl.actions_config
                      };
                      setWorkflows([imported, ...workflows]);
                      setActiveTab("designer");
                    }}
                    className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-all"
                  >
                    Use Template <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 4: EVENT STREAM */}
        {activeTab === "events" && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" /> Real-time System Event Stream
            </h2>
            <div className="space-y-3">
              {[
                { type: "BacklinkCreated", module: "backlink_lifecycle", time: "Just now", payload: '{"url": "https://example.com/blog", "da": 72}' },
                { type: "IndexVerified", module: "index_verification", time: "2 mins ago", payload: '{"url": "https://target.com/page-1", "indexed": true}' },
                { type: "ReportGenerated", module: "white_label", time: "10 mins ago", payload: '{"report_id": "rep_992", "type": "Executive"}' }
              ].map((evt, idx) => (
                <div key={idx} className="bg-slate-950 border border-slate-800/80 rounded-lg p-4 flex items-start justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-indigo-400">{evt.type}</span>
                      <span className="text-slate-500">•</span>
                      <span className="text-slate-400 font-mono">{evt.module}</span>
                    </div>
                    <p className="font-mono text-slate-300 mt-1">{evt.payload}</p>
                  </div>
                  <span className="text-slate-500 text-[11px]">{evt.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: SIMULATION PLAYGROUND */}
        {activeTab === "simulator" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" /> Simulation Input Payload
              </h2>
              <textarea
                value={simPayload}
                onChange={(e) => setSimPayload(e.target.value)}
                className="w-full h-64 bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs text-indigo-300 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleRunSimulation}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-lg text-sm flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" /> Run Dry Simulation
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Simulation Evaluation Logs</h2>
              {simResult ? (
                <div className="space-y-3 font-mono text-xs">
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300">
                    <strong>Trigger Matched:</strong> {simResult.is_trigger_matched ? "YES" : "NO"}<br />
                    <strong>Condition Evaluated:</strong> {simResult.is_condition_passed ? "PASSED" : "FAILED"}
                  </div>
                  <div className="p-4 bg-slate-950 rounded-lg space-y-2 border border-slate-800">
                    <span className="text-slate-400 font-bold">Execution Steps:</span>
                    {simResult.logs.map((log: string, idx: number) => (
                      <div key={idx} className="text-slate-300 flex items-center gap-2">
                        <span className="text-indigo-400">&gt;</span> {log}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">Run a simulation on the left to inspect rule matches and output step evaluation without modifying state.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
