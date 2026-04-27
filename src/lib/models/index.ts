import mongoose, { Schema } from 'mongoose';

// Ensure we don't overwrite models when hot reloading
const models = mongoose.models;

export const RoleSchema = new Schema({
  slug: { type: String, required: true, unique: true },
  name: { type: String, required: true },
}, { timestamps: true });

export const Role = models.Role || mongoose.model('Role', RoleSchema);

export const UserSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  emailLower: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  usernameLower: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  primaryRole: { type: String, required: true },
  roles: [{ type: String }],
  companyId: { type: Schema.Types.ObjectId, ref: 'Company' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export const User = models.User || mongoose.model('User', UserSchema);

export const CompanySchema = new Schema({
  companyName: { type: String, required: true },
  companyCode: { type: String, required: true, unique: true },
  sector: { type: String, required: true },
}, { timestamps: true });

export const Company = models.Company || mongoose.model('Company', CompanySchema);

export const RequestSchema = new Schema({
  requestNo: { type: String, required: true, unique: true },
  requestType: { type: String, required: true },
  routingType: { type: String, required: true },
  requestTitle: { type: String, required: true },
  category: { type: String, required: true },
  requestorId: { type: String, required: true },
  requestorName: { type: String, required: true },
  requestorEmail: { type: String, required: true },
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  companyCode: { type: String, required: true },
  companyName: { type: String, required: true },
  status: { type: String, default: 'Draft' },
  acknowledgement: { type: Boolean, default: false },
  submittedAt: { type: Date },
  verifierCommentText: { type: String },
  verifierDecisionCode: { type: String },
  verifiedBy: { type: String },
  verifiedAt: { type: Date },
}, { timestamps: true });

export const RequestModel = models.Request || mongoose.model('Request', RequestSchema);

export const ProjectSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  companyCode: { type: String, required: true },
  companyName: { type: String, required: true },
  projectName: { type: String, required: true },
  projectCode: { type: String },
  createdFromRequestId: { type: Schema.Types.ObjectId, ref: 'Request' },
}, { timestamps: true });

export const Project = models.Project || mongoose.model('Project', ProjectSchema);

export const RtpRequestSchema = new Schema({
  requestId: { type: Schema.Types.ObjectId, ref: 'Request', required: true, unique: true },
  clientName: { type: String, required: true },
  registrationType: { type: Number, required: true },
  tenderClosingDate: { type: Date },
  projectName: { type: String, required: true },
  projectDescription: { type: String, required: true },
  specialProject: { type: Boolean, default: false },
  documentUrl: { type: String },
  documentPublicId: { type: String },
  documentFileName: { type: String },
  documentMimeType: { type: String },
  documentSizeBytes: { type: Number },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project' },
}, { timestamps: true });

export const RtpRequest = models.RtpRequest || mongoose.model('RtpRequest', RtpRequestSchema);

export const PblRequestSchema = new Schema({
  requestId: { type: Schema.Types.ObjectId, ref: 'Request', required: true, unique: true },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  projectCode: { type: String },
  procurementMethod: { type: Number, required: true },
  justificationForLessBidders: { type: String },
  documentUrl: { type: String },
  documentPublicId: { type: String },
  documentFileName: { type: String },
  documentMimeType: { type: String },
  documentSizeBytes: { type: Number },
}, { timestamps: true });

export const PblRequest = models.PblRequest || mongoose.model('PblRequest', PblRequestSchema);

export const JvpRequestSchema = new Schema({
  requestId: { type: Schema.Types.ObjectId, ref: 'Request', required: true, unique: true },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
  projectCode: { type: String },
  teamLeader: { type: String },
  financialMatters: { type: String },
  technicalMatters: { type: String },
  contractMatters: { type: String },
  procurementMatters: { type: String },
  costingAndEstimationMatters: { type: String },
  implementationStage: { type: String },
  backgroundOfCollabPoints: { type: Schema.Types.Mixed },
  scopeOfCollabPoints: { type: Schema.Types.Mixed },
  proposedStructurePoints: { type: Schema.Types.Mixed },
  keyTermsPoints: { type: Schema.Types.Mixed },
  financialOverviewPoints: { type: Schema.Types.Mixed },
  technicalCapabilitiesPoints: { type: Schema.Types.Mixed },
  workPackagesDivisionPoints: { type: Schema.Types.Mixed },
  resourcesContributionPoints: { type: Schema.Types.Mixed },
  riskReviewMitigationItems: { type: Schema.Types.Mixed },
  cashflowForecastUrl: { type: String },
  cashflowForecastPublicId: { type: String },
  cashflowForecastFileName: { type: String },
  cashflowForecastMimeType: { type: String },
  cashflowForecastSizeBytes: { type: Number },
  costStructureUrl: { type: String },
  costStructurePublicId: { type: String },
  costStructureFileName: { type: String },
  costStructureMimeType: { type: String },
  costStructureSizeBytes: { type: Number },
  documentUrl: { type: String },
  documentPublicId: { type: String },
  documentFileName: { type: String },
  documentMimeType: { type: String },
  documentSizeBytes: { type: Number },
}, { timestamps: true });

export const JvpRequest = models.JvpRequest || mongoose.model('JvpRequest', JvpRequestSchema);

export const PblBidderSchema = new Schema({
  pblRequestId: { type: Schema.Types.ObjectId, ref: 'PblRequest', required: true },
  companyName: { type: String, required: true },
  location: { type: String },
  personInCharge: { type: String, required: true },
  picContactNumber: { type: String, required: true },
  sourcesFrom: { type: String, required: true },
  recommendationBy: { type: String, required: true },
}, { timestamps: true });

export const PblBidder = models.PblBidder || mongoose.model('PblBidder', PblBidderSchema);

export const VerifierCommentSchema = new Schema({
  requestId: { type: Schema.Types.ObjectId, ref: 'Request', required: true, unique: true },
  verifierId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  comment: { type: String, required: true },
  decisionCode: { type: String, required: true },
  verifiedBy: { type: String, required: true },
}, { timestamps: true });

export const VerifierComment = models.VerifierComment || mongoose.model('VerifierComment', VerifierCommentSchema);

export const ReviewerSuggestionSchema = new Schema({
  requestId: { type: Schema.Types.ObjectId, ref: 'Request', required: true },
  reviewerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  reviewerName: { type: String },
  suggestion: { type: String, required: true },
  sourceRole: { type: String },
  status: { type: String, default: 'pending' },
  action: { type: String },
}, { timestamps: true });

export const ReviewerSuggestion = models.ReviewerSuggestion || mongoose.model('ReviewerSuggestion', ReviewerSuggestionSchema);

export const EngagementSlotSchema = new Schema({
  slotName: { type: String, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  attendees: [{ type: String }],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export const EngagementSlot = models.EngagementSlot || mongoose.model('EngagementSlot', EngagementSlotSchema);

export const EngagementSchema = new Schema({
  requestId: { type: Schema.Types.ObjectId, ref: 'Request', required: true, unique: true },
  slotId: { type: Schema.Types.ObjectId, ref: 'EngagementSlot', required: true },
  requestorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, default: 'booked' },
  notes: { type: String },
}, { timestamps: true });

export const Engagement = models.Engagement || mongoose.model('Engagement', EngagementSchema);
