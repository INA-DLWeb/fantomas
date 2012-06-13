package Fantomas;

use strict;
use warnings;
use PhantomJS;

use enum::fields qw(
	PJS
	PJS_ITERATOR
);

# absolute path of the javascript resources of fantomas
my $JS_PATH = _get_abs_resource('./js/main.js');

sub new {
	my $class = shift;
	my %pjs_args = (@_);
	my $self = bless [], $class;
	
	$self->[PJS] = PhantomJS->new($JS_PATH, %pjs_args);
	
	$self
}

sub fetch {
	my $self = shift;
	my $url = shift;
	my $session_id = shift || 0;
	my $crawl_level = shift || 0;
	my $clicks = shift || 0;
	my $timeout = shift || 0;
	
	my $result = {};
	
	if ($self->[PJS_ITERATOR]) {
		print "Already fetching.";
		return $result;
	}
	
	# run PhantomJS. returns a file handler to read its standard output
	$self->[PJS_ITERATOR] = $self->[PJS]->open($url, $session_id, $crawl_level, $clicks);
	
	eval {
		# catch SIGINT and kill phantomjs
		local $SIG{INT} = sub {
			$self->[PJS_ITERATOR]->{kill}->() if $self->[PJS_ITERATOR];
			exit;
		};
		
		# setup timeout
		local $SIG{ALRM} = sub { die "timeout\n" };
		alarm $timeout;
		
		# read PhantomJS' standard output line by line
		while (my $json = $self->[PJS_ITERATOR]->{next}->()) {
			# if the result has an URL field, store it with its type to report it 
			# (types: link, resource)
			$result->{$json->{type}}->{$json->{url}} = 1 if $json->{url};
		}
		# detect possible errors and add them to the result
		if ($self->[PJS_ITERATOR]->{error}->()) {
			$result->{error} = $self->[PJS_ITERATOR]->{error}->();
		}
		# free the iterator
		$self->[PJS_ITERATOR] = undef;
		
	};
	alarm 0;
	if ($@) {
		die unless $@ eq "timeout\n";
		$result->{error} = "external timeout ($timeout seconds) [$url]";
		$self->stop_fetch("timed out after $timeout seconds [$url]");
	}
	
	# return found URLs (and possible errors)
	$result
}

sub stop_fetch {
	my $self = shift;
	my $message = shift || 'requested';
	if (defined $self->[PJS_ITERATOR]) {
		print "Killing PhantomJS ... ($message)\n";
		$self->[PJS_ITERATOR]->{kill}->();
	}
}

# static sub
sub _get_abs_resource {
	my $path = shift;
	return $path if $path =~ m!^/!;
	require Cwd;
	(my $dir = __FILE__) =~ s![^/]+$!!;
	(my $cwd = Cwd::getcwd()) =~ s!/$!!;
	my @dirs = grep {length} split(/\//, "$cwd/$dir");
	my @path = grep {length} split(/\//, $path);

	while (local $_ = shift @path) {
		pop @dirs, next if /^\.\.$/;
		next if /^\.$/;
		return join('/', '', @dirs, $_, @path);
	}
}


# EOF
1
