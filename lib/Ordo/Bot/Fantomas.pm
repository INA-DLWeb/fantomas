package Ordo::Bot::Fantomas;
use strict;
use warnings;
use Carp;
use Anet;
use Fantomas;
use List::Util qw(max);

use base 'Ordo::Bot::Crawler';
use enum::fields::extending 'Ordo::Bot::Crawler', qw(
	FANTOMAS
	CURRENT_URL
	CLICKS
	PAGE_TIMEOUT
);

# INTERFACE
sub fork_on_duplicate {
	1
}

# 'stop_fetch' does not work here because 'fetch' 
# is started in an 'async' block, so the pid is not 
# visible to us.
#
# sub stop {
	# my $self = shift;
	
	# return 0 if !$self->SUPER::stop(@_);
	# $self->[FANTOMAS]->stop_fetch() if $self->[FANTOMAS];
	
	# 1
# }

# INTERFACE (overriden to add Fantomas init)
sub start {
	my $self = shift;
	return 0 unless $self->SUPER::start(@_);
	
	my $bot_args = $self->[PARAMETERS];
	
	# read PhantomJS arguments and initialize PhantomJS
	my $pjs_args = $bot_args->{pjs_args} || croak 'missing "pjs_args" hash in run() arguments';

	# maximum number of random hardware clicks
	$self->[CLICKS] = $bot_args->{clicks} // croak 'missing "clicks" in run() arguments';
	
	# maximum time spent on one page
	$self->[PAGE_TIMEOUT] = $bot_args->{page_timeout} // croak 'missing "page_timeout" in run() arguments';
	
	$self->[FANTOMAS] = Fantomas->new(
		%$pjs_args,
		proxy => $bot_args->{proxy}
	);
	
	1
}

sub work {
	my ($self, $cb) = @_;
	
	# read the next target to fetch to. return when no more targets.
	my $target_fields = $self->[QUEUE]->get;
	
	if (!$target_fields) {
		$cb->call({
			stop => 1,
			message => "Queue empty",
		});
		return;
	}
	
	print "doing: ", $target_fields->{url}, "\n";
	$self->[CURRENT_URL] = $target_fields->{url};
	
	async {
		$self->[FANTOMAS]->fetch(
			$target_fields->{url},
			$self->[SESSION_NAME],
			$self->[CURRENT_LEVEL],
			$self->[CLICKS],
			$self->[PAGE_TIMEOUT],
		)
	} cb(_on_work_done => $self, $cb, $target_fields)->timed 
}

sub _on_work_done {
	my $self = shift;
	my $cb = shift;
	my $target_fields = shift;
	my $duration = shift;
	my $fetch_result = shift;
	my $needed_delay = max(0, $self->[URL_DELAY] - $duration);
	my @links     = keys(%{($fetch_result->{'link'}     || {})});
	my @resources = keys(%{($fetch_result->{'resource'} || {})});
	my @frames   = keys(%{($fetch_result->{'frame'}   || {})});
	
	my $log_prefix = sprintf(
		"%d/%d [t:%06.2f+%06.2f]",
		$self->[CURRENT_LEVEL],
		$self->[MAX_LEVEL],
		$duration,
		$needed_delay
	);
	if ($fetch_result->{error}) {
		# fetching the page failed, retry if we did not reach MAX_RETRY for this URL
		my $retry = ++$target_fields->{retries} < $self->[MAX_RETRY];
		
		print $log_prefix, sprintf(
			" failed and %s (%d/%d) for '%s'. ERROR:[%s]\n",
			($retry ? "retrying" : "giving up"),
			$target_fields->{retries},
			$self->[MAX_RETRY],
			$target_fields->{url},
			$fetch_result->{error}
		);
		
		$self->[QUEUE]->retry_in(3, $target_fields) if $retry;
		
	} else {
		# fetching the page was successful, print happiness
		print $log_prefix, sprintf(
			" got %4d links and %4d resources at '%s'\n", 
			scalar(@links), 
			scalar(@resources), 
			$target_fields->{url}
		);
	}
	
	$self->report_to_queue(
		referer   => $target_fields->{url},
		# explore frames that could not be reached by javascript (cross-domain issues)
		put_now => \@frames,
		done    => \@resources,
		links   => \@links,
	);
	
	delay { $cb->call; } $needed_delay ;
}

# INTERFACE
sub info {
	my $self = shift;

	my $info = $self->SUPER::info;
	$info->{current_url} = $self->[CURRENT_URL];

	$info
}

# EOF
1
